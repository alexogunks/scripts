import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useRef } from 'react';
import { AchievementBlueprint, AchievementGroup, ObjectiveBlueprint, RewardType } from '@enums/achievements';
import { useThrottle } from '@hooks/useThrottle';
import { useWebSocketMessenger } from '@hooks/useWebSocketMessenger';
import { WebSocketResponseAchievementsGet, WebSocketResponseQuestGet } from '@interfaces/WebSocketResponse';
import { withSafeRetry } from '@utils/async';
import { Collection } from '@utils/collection';
import moment from 'moment';
import { CONFIG } from '@/constants';

export interface IRewardBaseBlueprint {
  type: RewardType;
}

export interface IRewardConsumableBlueprint extends IRewardBaseBlueprint {
  consumableBlueprintID: string;
  quantity: number;
}

export interface IRewardTokenBlueprint extends IRewardBaseBlueprint {
  tokens: bigint;
}

export interface IRewardXpBlueprint extends IRewardBaseBlueprint {
  xp: number;
}

export type IRewardBlueprint = IRewardConsumableBlueprint | IRewardTokenBlueprint | IRewardXpBlueprint;

export function isXpReward(reward: IRewardBlueprint): reward is IRewardXpBlueprint {
  return reward.type === RewardType.XP;
}

export function isTokenReward(reward: IRewardBlueprint): reward is IRewardTokenBlueprint {
  return reward.type === RewardType.TOKEN;
}

export function isConsumableReward(reward: IRewardBlueprint): reward is IRewardConsumableBlueprint {
  return reward.type === RewardType.CONSUMABLE;
}

export type RewardMap = {
  CONSUMABLE: IRewardConsumableBlueprint;
  TOKEN: IRewardTokenBlueprint;
  XP: IRewardXpBlueprint;
};

export interface IObjectiveBlueprint {
  id: ObjectiveBlueprint;
  name: string;
  description: string;
  canBeDailyQuest: boolean;
}

export interface IObjective {
  blueprint: IObjectiveBlueprint;
  blueprintID: ObjectiveBlueprint;
  progressRequired: number;
}

export interface IAchievementBlueprint {
  id: AchievementBlueprint;
  name: string;
  description: string;
  tier: number;
  objectives: IObjective[];
  rewards: IRewardBlueprint[];
}

export interface IObjectiveActive {
  progress: number;
  progressMax: number;
  blueprint: IObjectiveBlueprint;
  blueprintID: ObjectiveBlueprint;
}

export interface IAchievementGroup {
  id: AchievementGroup;
  achievements: IAchievement[];
}

export interface IAchievement {
  id: string;
  group: AchievementGroup;
  blueprint: IAchievementBlueprint;
  blueprintID: AchievementBlueprint;
  petID: string;
  claimed: boolean;
  completed: boolean;
  objectives: IObjectiveActive[];
}

export interface IQuest {
  id: string;
  name: string;
  description: string;
  claimed: boolean;
  completed: boolean;
  petID: string;
  timeExpired: moment.Moment;
  reward: IRewardBlueprint;
  objective: IObjectiveActive;
}

export class Achievements extends Collection<IAchievement> {
  public getByBlueprintID(blueprint: AchievementBlueprint): IAchievement | undefined {
    return this.find(item => item.blueprintID === blueprint);
  }

  public getGrouped(): IAchievementGroup[] {
    return Object.keys(AchievementGroup).flatMap(group => {
      return {
        id: group as AchievementGroup,
        achievements: this.items.filter(a => a.group === group),
      };
    });
  }
}

export class Quests extends Collection<IQuest> {}

export interface IAchievementContext {
  loading: boolean;
  quests: Quests;
  questsHasLoadedOnce: boolean;
  achievements: Achievements;
  achievementsHasLoadedOnce: boolean;
  loadQuests: () => Promise<void>;
  questUse: () => Promise<boolean>;
}

function getTypedReward<T extends RewardType>(reward: { type: T | string; reward: any }): RewardMap[T] {
  if (reward.type === 'TOKEN') {
    return { type: reward.type, tokens: BigInt(reward.reward.tokens) } as RewardMap[T];
  }

  return { type: reward.type, ...reward.reward } as RewardMap[T];
}

const AchievementContext = createContext<IAchievementContext | undefined>(undefined);

export const AchievementProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { achievementsGet, questGet, questUse: questUseRequest } = useWebSocketMessenger();
  const [loading, setLoading] = useState<boolean>(true);

  const [achievementBlueprints, setAchievementBlueprints] = useState<IAchievementBlueprint[]>([]);
  const [objectiveBlueprints, setObjectiveBlueprints] = useState<IObjectiveBlueprint[]>([]);
  const achievementBlueprintsRef = useRef(achievementBlueprints);
  const objectiveBlueprintsRef = useRef(objectiveBlueprints);

  const [quests, setQuests] = useState<Quests>(new Quests([]));
  const [questsHasLoadedOnce, setQuestsHasLoadedOnce] = useState<boolean>(false);

  const [achievements, setAchievements] = useState<Achievements>(new Achievements([]));
  const [achievementsHasLoadedOnce, setAchievementsHasLoadedOnce] = useState<boolean>(false);

  const getObjectiveBlueprint = useCallback((blueprintID: ObjectiveBlueprint): IObjectiveBlueprint | undefined => {
    return objectiveBlueprintsRef.current.find(blueprint => blueprint.id === blueprintID);
  }, []);

  const fetchQuestsData = useCallback(async (): Promise<WebSocketResponseQuestGet> => {
    const response = await withSafeRetry(() => questGet());

    if (!response || response.error || !response.data?.quest) {
      throw new Error(response?.error || 'Failed to load quest');
    }

    return response;
  }, [questGet]);

  const throttleFetchQuestsData = useThrottle(fetchQuestsData, { time: CONFIG.THROTTLE.TIME_API });

  const fetchAchievementsData = useCallback(async (): Promise<WebSocketResponseAchievementsGet> => {
    const response = await withSafeRetry(() => achievementsGet());

    if (!response || response.error || !response.data?.achievements) {
      throw new Error(response?.error || 'Failed to load achievements');
    }

    return response;
  }, [achievementsGet]);

  const throttleFetchAchievementsData = useThrottle(fetchAchievementsData, { time: CONFIG.THROTTLE.TIME_API });

  const loadAchievements = useCallback(
    async (throttle = true) => {
      setLoading(true);

      try {
        const response = await (throttle ? throttleFetchAchievementsData() : throttleFetchAchievementsData.force());

        const newObjectiveBlueprints = Object.entries(response.data.objectiveBlueprint).map(([_, blueprint]) => {
          return {
            id: blueprint.id,
            name: blueprint.name,
            description: blueprint.description,
            canBeDailyQuest: blueprint.canBeDailyQuest,
          } as IObjectiveBlueprint;
        });

        const newAchievementBlueprints = Object.entries(response.data.achievementBlueprint).map(([_, blueprint]) => {
          return {
            id: blueprint.id,
            name: blueprint.name,
            description: blueprint.description,
            tier: blueprint.tier,
            objectives: blueprint.objectives.map(objective => {
              const objectiveBlueprint = newObjectiveBlueprints.find(o => o.id === objective.blueprint);

              return {
                blueprint: objectiveBlueprint,
                blueprintID: objective.blueprint,
                progressRequired: objective.progressRequired,
              } as IObjective;
            }),
            rewards: blueprint.reward.rewards.map(reward => getTypedReward(reward)),
          } as IAchievementBlueprint;
        });

        const newAchievements = Object.entries(response.data.achievements).flatMap(([group, achievements]) => {
          return Object.entries(achievements).map(([_, achievement]) => {
            return {
              id: achievement.id,
              group: group,
              blueprint: newAchievementBlueprints.find(b => b.id === achievement.achievementBlueprint),
              blueprintID: achievement.achievementBlueprint,
              petID: achievement.petID,
              claimed: achievement.claimed,
              objectives: achievement.objectives?.map(data => {
                return {
                  progress: data.objective.progress,
                  progressMax: data.objective.progressMax,
                  blueprintID: data.objective.objectiveBlueprint,
                  blueprint: newObjectiveBlueprints.find(o => o.id === data.objective.objectiveBlueprint),
                } as IObjectiveActive;
              }),
            } as IAchievement;
          });
        });

        setObjectiveBlueprints(newObjectiveBlueprints);
        setAchievementBlueprints(newAchievementBlueprints);
        setAchievements(new Achievements(newAchievements));
        setAchievementsHasLoadedOnce(true);
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
    },
    [throttleFetchAchievementsData],
  );

  const loadQuests = useCallback(
    async (throttle = true) => {
      setLoading(true);

      try {
        // Load achievements for blueprints
        await loadAchievements(throttle);
        const response = await (throttle ? throttleFetchQuestsData() : throttleFetchQuestsData.force());

        const reward = getTypedReward(response.data.quest.reward.rewards[0]);

        if (isConsumableReward(reward)) {
          // @TODO get consumable blueprint?
        }

        const quest = {
          id: response.data.quest.id,
          name: response.data.quest.name,
          description: response.data.quest.description,
          claimed: response.data.quest.claimed,
          petID: response.data.quest.petId,
          timeExpired: moment(response.data.quest.timeExpired),
          reward: reward,
          objective: {
            blueprint:
              getObjectiveBlueprint(
                response.data.quest.objectives[0].objective.objectiveBlueprint as ObjectiveBlueprint,
              ) || {},
            blueprintID: response.data.quest.objectives[0].objective.objectiveBlueprint,
            progress: response.data.quest.objectives[0].objective.progress,
            progressMax: response.data.quest.objectives[0].objective.progressMax,
          } as IObjectiveActive,
          completed:
            response.data.quest.objectives[0].objective.progress ===
            response.data.quest.objectives[0].objective.progressMax,
        } as IQuest;

        setQuests(new Quests([quest]));
        setQuestsHasLoadedOnce(true);
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
    },
    [throttleFetchQuestsData, getObjectiveBlueprint, loadAchievements],
  );

  const questUse = useCallback(async () => {
    setLoading(true);

    const response = await withSafeRetry(() => questUseRequest());

    if (!response || response.error) {
      setLoading(false);

      return Promise.reject('Failed to claim reward');
    }

    await loadQuests(false);

    setLoading(false);

    return true;
  }, [loadQuests, questUseRequest]);

  useEffect(() => {
    objectiveBlueprintsRef.current = objectiveBlueprints;
  }, [objectiveBlueprints]);

  useEffect(() => {
    achievementBlueprintsRef.current = achievementBlueprints;
  }, [achievementBlueprints]);

  return (
    <AchievementContext.Provider
      value={{
        loading,
        quests,
        questsHasLoadedOnce,
        achievements,
        achievementsHasLoadedOnce,
        loadQuests,
        questUse,
      }}
    >
      {children}
    </AchievementContext.Provider>
  );
};

export const useAchievement = (): IAchievementContext => {
  const context = useContext(AchievementContext);

  if (context === undefined) {
    throw new Error('useAchievement must be used within a AchievementProvider');
  }

  return context;
};
