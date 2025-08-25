import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { useThrottle } from '@hooks/useThrottle';
import { useWebSocketMessenger } from '@hooks/useWebSocketMessenger';
import {
  WebSocketMessageDataGuild,
  WebSocketMessageDataGuildMemberRole,
  WebSocketMessageDataGuildMemberSort,
  WebSocketMessageDataGuildUpgradeType,
} from '@interfaces/WebSocketMessage';
import {
  WebSocketGuildDetails,
  WebSocketGuildDetailsWithCount,
  WebSocketGuildInfo,
  WebSocketGuildInfoSelf,
  WebSocketGuildMember,
  WebSocketGuildMemberWithPetPreview,
} from '@interfaces/WebSocketResponse';
import { withSafeRetry } from '@utils/async';
import { Collection } from '@utils/collection';
import { Token } from '@utils/token';
import moment from 'moment';
import { CONFIG } from '@/constants';

export enum GuildAccessType {
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC',
}

export enum GuildMemberRole {
  LEADER = 'LEADER',
  CO_LEADER = 'CO_LEADER',
  MODERATOR = 'MODERATOR',
  MEMBER = 'MEMBER',
}

export enum GuildMembersSort {
  NEWEST = 'newest',
  CONTRIBUTION = 'contribution',
}

export enum GuildMembersRolesFilter {
  LEADER = 'LEADER',
  CO_LEADER = 'CO_LEADER',
  MODERATOR = 'MODERATOR',
  MEMBER = 'MEMBER',
}

export type GuildUpgradeType = 'maxMembers' | 'defense' | 'attack';

export interface IGuildMemberPet {
  id: string;
  name: string;
  xp: number;
}

export enum GuildInviteStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface IGuildInvite {
  id: string;
  status: GuildInviteStatus;
  petID: string;
  guildID: number;
  message: string | null;
  createdAt: moment.Moment;
  updatedAt: moment.Moment;
  handledBy: string;
  handledAt: moment.Moment | null;
  guild: IGuild;
}

export interface IGuildMember {
  bowContributions: number;
  id: string;
  joinedAt: moment.Moment;
  lastActiveAt?: moment.Moment;
  lastPunchAt?: moment.Moment;
  notificationsEnabled: boolean;
  pet?: IGuildMemberPet;
  petID: string;
  punchContributions: number;
  role: GuildMemberRole;
  shieldContributions: number;
  swordContributions: number;
  totalContribution: number;
}

export interface IGuildUpgradeMemberCapCost {
  members: number;
  cost: Token;
}

export interface IGuildUpgradeCosts {
  memberCap: GuildUpgradeMemberCapCosts;
}

export interface IGuildSearch {
  accessType: GuildAccessType;
  description: string;
  id: number;
  maxMembers: number;
  membersCount: number;
  name: string;
  tag: string;
}

export interface IGuild {
  accessType: GuildAccessType;
  banner?: string;
  createdAt?: moment.Moment;
  description: string;
  experience: number;
  featured: boolean;
  id: number;
  maxMembers: number;
  name: string;
  tag: string;
  vaultAmount: Token;
  verified: boolean;
  membersCount: number;
  members?: GuildMembers;
  level?: number;
  rank?: number;
  totalContribution?: number;
  me?: IGuildMember;
  war?: any;
}

class Guilds extends Collection<IGuild> { }
class GuildSearches extends Collection<IGuildSearch> { }
export class GuildMembers extends Collection<IGuildMember> { }

class GuildInvites extends Collection<IGuildInvite> {
  getByStatus(status: GuildInviteStatus) {
    return this.filter(invite => invite.status === status);
  }
  get pending(): IGuildInvite[] {
    return this.getByStatus(GuildInviteStatus.PENDING);
  }
  get approved(): IGuildInvite[] {
    return this.getByStatus(GuildInviteStatus.APPROVED);
  }
  get rejected(): IGuildInvite[] {
    return this.getByStatus(GuildInviteStatus.REJECTED);
  }
}

class GuildUpgradeMemberCapCosts extends Collection<IGuildUpgradeMemberCapCost> {
  getNextUpgrade() {
    if (this.length === 0) {
      return undefined;
    }

    return this.items.sort((a, b) => (a.members > b.members ? 1 : -1))[0];
  }
}

const makeGuildObject = (
  data: WebSocketGuildDetails | WebSocketGuildDetailsWithCount | WebSocketGuildInfoSelf,
  members?: WebSocketGuildMemberWithPetPreview[],
  totalMembers?: number,
): IGuild => {
  const guild = {
    accessType: data.accessType as string as GuildAccessType,
    banner: data.banner ? data.banner : undefined,
    createdAt: 'createdAt' in data ? moment(data.createdAt) : undefined,
    description: data.description,
    experience: Number(data.experience),
    featured: data.featured,
    id: data.id,
    maxMembers: data.maxMembers,
    name: data.name,
    tag: data.tag,
    vaultAmount: new Token(BigInt(data.vaultAmount)),
    verified: data.verified,
    membersCount:
      'memberCount' in data
        ? data.memberCount
        : totalMembers
          ? totalMembers
          : '_count' in data
            ? data._count?.members || 0
            : 0,
    level: 'level' in data ? data.level : undefined,
    rank: 'rank' in data ? data.rank : undefined,
    totalContribution: 'totalContribution' in data ? data.totalContribution : undefined,
  } as IGuild;

  if (members) {
    const newMembers: IGuildMember[] = members.map(member => makeGuildMemberObject(member));

    guild.members = new GuildMembers(newMembers);
  }

  return guild;
};

const makeGuildSearchObject = (data: WebSocketGuildInfo): IGuildSearch => {
  return {
    accessType: data.accessType as string as GuildAccessType,
    description: data.description,
    id: data.id,
    maxMembers: data.maxMembers,
    name: data.name,
    tag: data.tag,
    membersCount: data.memberCount,
  };
};

const makeGuildMemberObject = (data: WebSocketGuildMemberWithPetPreview | WebSocketGuildMember): IGuildMember => {
  return {
    bowContributions: data.bowContributions,
    id: data.id,
    joinedAt: moment(data.joinedAt),
    lastActiveAt: data.lastActive ? moment(data.lastActive) : undefined,
    lastPunchAt: data.lastPunchTime ? moment(data.lastPunchTime) : undefined,
    notificationsEnabled: data.notificationsEnabled,
    petID: data.petID,
    pet:
      'pet' in data
        ? {
          id: data.pet.id,
          name: data.pet.name,
          xp: Number(data.pet.PetStats.xp),
        }
        : undefined,
    punchContributions: data.punchContributions,
    role: data.role as string as GuildMemberRole,
    shieldContributions: data.shieldContributions,
    swordContributions: data.swordContributions,
    totalContribution: Number(data.totalContribution),
  };
};

export interface IGuildContext {
  loading: boolean;

  myGuild: IGuild | null;
  myGuildHasLoadedOnce: boolean;
  myGuildMembersHasLoadedOnce: boolean;
  loadMyGuild: () => Promise<void>;
  loadMyGuildMembers: (sort?: GuildMembersSort, filter?: GuildMembersRolesFilter) => Promise<void>;

  topGuilds: Guilds;
  topGuildsHasLoadedOnce: boolean;
  loadTopGuilds: () => Promise<void>;

  currentGuild: IGuild | null;
  currentGuildHasLoaded: boolean;
  loadCurrentGuild: (id: number) => Promise<void>;

  currentSearchQuery: string;
  currentSearchGuilds: GuildSearches;
  currentSearchGuildsHasLoaded: boolean;
  loadCurrentSearchGuilds: (query: string) => Promise<void>;

  invites: GuildInvites;
  invitesHasLoadedOnce: boolean;
  loadInvites: () => Promise<void>;

  createCost: Token;
  createCostHasLoadedOnce: boolean;
  loadCreateCost: () => Promise<void>;

  upgradeCosts: IGuildUpgradeCosts;
  upgradeCostsHasLoadedOnce: boolean;
  loadUpgradeCosts: () => Promise<void>;

  create: (data: WebSocketMessageDataGuild) => Promise<IGuild | null>;
  invite: (id: string, message?: string) => Promise<boolean>;
  inviteRespond: (guildId: number, accept: boolean) => Promise<boolean>;
  leave: () => Promise<boolean>;
  deposit: (token: Token) => Promise<boolean>;
  upgrade: (type: GuildUpgradeType, value: number) => Promise<boolean>;
  update: (data: WebSocketMessageDataGuild) => Promise<boolean>;
  transfer: (newLeaderId: string) => Promise<boolean>;
}

const GuildContext = createContext<IGuildContext | undefined>(undefined);

export const GuildProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const {
    guildGetSelf,
    guildGetTop,
    guildGet,
    guildSearch,
    guildMembersGet,
    guildCreate,
    guildLeave,
    guildInviteCreate,
    guildJoinRequestsGet,
    guildInviteRespond,
    guildDeposit,
    guildCostCreate,
    guildCostUpgrade,
    guildUpgrade,
    guildUpdateInfo,
    guildUpdateLeader,
  } = useWebSocketMessenger();

  // States
  const [loading, setLoading] = useState<boolean>(false);

  const [currentGuild, setCurrentGuild] = useState<IGuild | null>(null);
  const [currentGuildHasLoaded, setCurrentGuildHasLoaded] = useState<boolean>(false);

  const [myGuild, setMyGuild] = useState<IGuild | null>(null);
  const [myGuildHasLoadedOnce, setMyGuildHasLoadedOnce] = useState<boolean>(false);
  const [myGuildMembersHasLoadedOnce, setMyGuildMembersHasLoadedOnce] = useState<boolean>(false);

  const [topGuilds, setTopGuilds] = useState<Guilds>(new Guilds([]));
  const [topGuildsHasLoadedOnce, setTopGuildsHasLoadedOnce] = useState<boolean>(false);

  const [currentSearchQuery, setCurrentSearchQuery] = useState<string>('');
  const [currentSearchGuilds, setCurrentSearchGuilds] = useState<GuildSearches>(new GuildSearches([]));
  const [currentSearchGuildsHasLoaded, setCurrentSearchGuildsHasLoaded] = useState<boolean>(false);

  const [invites, setInvites] = useState<GuildInvites>(new GuildInvites([]));
  const [invitesHasLoadedOnce, setInvitesHasLoadedOnce] = useState<boolean>(false);

  const [createCost, setCreateCost] = useState<Token>(new Token());
  const [createCostHasLoadedOnce, setCreateCostHasLoadedOnce] = useState<boolean>(false);

  const [upgradeCosts, setUpgradeCosts] = useState<IGuildUpgradeCosts>({} as IGuildUpgradeCosts);
  const [upgradeCostsHasLoadedOnce, setUpgradeCostsHasLoadedOnce] = useState<boolean>(false);

  const fetchCurrentGuild = useCallback(
    async (id: number) => {
      const response = await withSafeRetry(() => guildGet(id));

      if (!response || response.error || !response.data?.guild) {
        throw new Error(response?.error || 'Failed to load current guild');
      }

      return response;
    },
    [guildGet],
  );

  const throttleFetchCurrentGuild = useThrottle(fetchCurrentGuild, { time: CONFIG.THROTTLE.TIME_API });

  const loadCurrentGuild = useCallback(
    async (id: number, throttle = true) => {
      setLoading(true);
      setCurrentGuildHasLoaded(false);

      try {
        const response = await (throttle ? throttleFetchCurrentGuild(id) : throttleFetchCurrentGuild.force(id));

        const newCurrentGuild = makeGuildObject(
          response.data.guild,
          response.data.guildMembers.members,
          response.data.guildMembers.totalCount,
        );

        setCurrentGuild(newCurrentGuild);
        setCurrentGuildHasLoaded(true);
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
    },
    [throttleFetchCurrentGuild],
  );

  const fetchMyGuild = useCallback(async () => {
    const response = await withSafeRetry(() => guildGetSelf());

    if (response?.error?.includes('Pet is not in a guild')) {
      return null;
    }

    if (!response || response.error) {
      throw new Error(response?.error || 'Failed to load pet guild');
    }

    return response;
  }, [guildGetSelf]);

  const throttleFetchMyGuild = useThrottle(fetchMyGuild, { time: CONFIG.THROTTLE.TIME_API });

  const loadMyGuild = useCallback(
    async (throttle = true) => {
      setLoading(true);

      try {
        const response = await (throttle ? throttleFetchMyGuild() : throttleFetchMyGuild.force());

        if (response) {
          setMyGuild(prevState => {
            const guild = makeGuildObject(response.data.guild);

            guild.me = makeGuildMemberObject(response.data.guildMemberInfo);

            if (!prevState) {
              return guild;
            }

            return {
              ...prevState,
              ...makeGuildObject(response.data.guild),
            };
          });
        }

        setMyGuildHasLoadedOnce(true);
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
    },
    [throttleFetchMyGuild],
  );

  const resetMyGuild = useCallback(() => {
    setMyGuild(null);
    setMyGuildHasLoadedOnce(false);
    setMyGuildMembersHasLoadedOnce(false);
  }, []);

  const fetchMyGuildMembers = useCallback(
    async (sort?: GuildMembersSort, filter?: GuildMembersRolesFilter) => {
      const response = await withSafeRetry(() =>
        guildMembersGet(
          sort as string as WebSocketMessageDataGuildMemberSort,
          filter as string as WebSocketMessageDataGuildMemberRole,
        ),
      );

      if (response?.error?.includes('Pet is not in a guild')) {
        return null;
      }

      if (!response || response.error) {
        throw new Error(response?.error || 'Failed to load pet guild');
      }

      return response;
    },
    [guildMembersGet],
  );

  const throttleFetchMyGuildMembers = useThrottle(fetchMyGuildMembers, { time: CONFIG.THROTTLE.TIME_API });

  const loadMyGuildMembers = useCallback(
    async (sort?: GuildMembersSort, filter?: GuildMembersRolesFilter, throttle = true) => {
      setLoading(true);

      try {
        const response = await (throttle
          ? throttleFetchMyGuildMembers(sort, filter)
          : throttleFetchMyGuildMembers.force(sort, filter));

        if (response) {
          setMyGuild(prevState => {
            if (!prevState) {
              return null;
            }

            return {
              ...prevState,
              members: new GuildMembers(
                response.data.guildMembers?.members.map(member => makeGuildMemberObject(member)) || [],
              ),
            };
          });
        }

        setMyGuildMembersHasLoadedOnce(true);
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
    },
    [throttleFetchMyGuildMembers],
  );

  const fetchTopGuilds = useCallback(async () => {
    const response = await withSafeRetry(() => guildGetTop());

    if (!response || response.error || !response.data?.topGuilds) {
      throw new Error(response?.error || 'Failed to load top guilds');
    }

    return response;
  }, [guildGetTop]);

  const throttleFetchTopGuilds = useThrottle(fetchTopGuilds, { time: CONFIG.THROTTLE.TIME_API });

  const loadTopGuilds = useCallback(
    async (throttle = true) => {
      setLoading(true);

      try {
        const response = await (throttle ? throttleFetchTopGuilds() : throttleFetchTopGuilds.force());

        const newTopGuilds = new Guilds(response.data.topGuilds.map(guild => makeGuildObject(guild)));

        setTopGuilds(newTopGuilds);
        setTopGuildsHasLoadedOnce(true);
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
    },
    [throttleFetchTopGuilds],
  );

  const fetchCurrentSearchGuilds = useCallback(
    async (query: string) => {
      const response = await withSafeRetry(() => guildSearch(query));

      if (!response || response.error) {
        throw new Error(response?.error || 'Failed to load search guilds');
      }

      return response;
    },
    [guildSearch],
  );

  const throttleFetchCurrentSearchGuilds = useThrottle(fetchCurrentSearchGuilds, { time: CONFIG.THROTTLE.TIME_API });

  const loadCurrentSearchGuilds = useCallback(
    async (query: string, throttle = true) => {
      setLoading(true);
      setCurrentSearchGuildsHasLoaded(false);
      setCurrentSearchQuery(query);

      try {
        const response = await (throttle
          ? throttleFetchCurrentSearchGuilds(query)
          : throttleFetchCurrentSearchGuilds.force(query));

        const newSearchGuilds = new GuildSearches(
          response.data.guild?.map(guild => makeGuildSearchObject(guild)) || [],
        );

        setCurrentSearchGuilds(newSearchGuilds);
        setCurrentSearchGuildsHasLoaded(true);
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
    },
    [throttleFetchCurrentSearchGuilds],
  );

  const fetchInvites = useCallback(async () => {
    const response = await withSafeRetry(() => guildJoinRequestsGet());

    if (!response || response.error || !response.data?.guildJoinRequests) {
      throw new Error(response?.error || 'Failed to load invites');
    }

    return response;
  }, [guildJoinRequestsGet]);

  const throttleFetchInvites = useThrottle(fetchInvites, { time: CONFIG.THROTTLE.TIME_API });

  const loadInvites = useCallback(
    async (throttle = true) => {
      setLoading(true);

      try {
        const response = await (throttle ? throttleFetchInvites() : throttleFetchInvites.force());

        const newInvites = response.data.guildJoinRequests.map(invite => {
          return {
            id: invite.id,
            status: invite.status as string as GuildInviteStatus,
            petID: invite.petID,
            guildID: invite.guildID,
            message: invite.message,
            handledBy: invite.handledBy,
            createdAt: moment(invite.createdAt),
            updatedAt: moment(invite.updatedAt),
            handledAt: invite.handledAt ? moment(invite.handledAt) : null,
            guild: makeGuildObject(invite.guild),
          } as IGuildInvite;
        });

        setInvites(new GuildInvites(newInvites));
        setInvitesHasLoadedOnce(true);
      } catch (e) {
        setInvites(new GuildInvites([]));
        console.error(e);
      }

      setLoading(false);
    },
    [throttleFetchInvites],
  );

  const fetchCreateCost = useCallback(async () => {
    const response = await withSafeRetry(() => guildCostCreate());

    if (!response || response.error || !response.data.cost) {
      throw new Error(response?.error || 'Failed to load create cost');
    }

    return response;
  }, [guildCostCreate]);

  const throttleFetchCreateCost = useThrottle(fetchCreateCost, { time: CONFIG.THROTTLE.TIME_API });

  const loadCreateCost = useCallback(
    async (throttle = true) => {
      setLoading(true);

      try {
        const response = await (throttle ? throttleFetchCreateCost() : throttleFetchCreateCost.force());

        setCreateCost(new Token(BigInt(response.data.cost)));
        setCreateCostHasLoadedOnce(true);
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
    },
    [throttleFetchCreateCost],
  );

  const fetchUpgradeCost = useCallback(async () => {
    const response = await withSafeRetry(() => guildCostUpgrade());

    if (!response || response.error || !response.data) {
      throw new Error(response?.error || 'Failed to load upgrade cost');
    }

    return response;
  }, [guildCostUpgrade]);

  const throttleFetchUpgradeCost = useThrottle(fetchUpgradeCost, { time: CONFIG.THROTTLE.TIME_API });

  const loadUpgradeCosts = useCallback(
    async (throttle = true) => {
      setLoading(true);

      try {
        const response = await (throttle ? throttleFetchUpgradeCost() : throttleFetchUpgradeCost.force());

        const newCosts = {
          memberCap: new GuildUpgradeMemberCapCosts(
            response.data.costToUpgradeMemberCap.map(cost => {
              return {
                members: cost.members,
                cost: new Token(BigInt(cost.cost)),
              };
            }),
          ),
        } as IGuildUpgradeCosts;

        setUpgradeCosts(newCosts);
        setUpgradeCostsHasLoadedOnce(true);
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
    },
    [throttleFetchUpgradeCost],
  );

  const upgrade = useCallback(
    async (type: GuildUpgradeType, value: number): Promise<boolean> => {
      const response = await withSafeRetry(() => guildUpgrade(type as WebSocketMessageDataGuildUpgradeType, value));

      if (!response || response.error || !response.data?.success) {
        throw new Error(response?.error || 'Failed to upgrade');
      }

      await loadUpgradeCosts(false);

      return true;
    },
    [guildUpgrade, loadUpgradeCosts],
  );

  const create = useCallback(
    async (data: WebSocketMessageDataGuild): Promise<IGuild | null> => {
      const response = await withSafeRetry(() => guildCreate(data));

      if (response?.data?.createdGuild) {
        await loadMyGuild(false);

        return makeGuildObject(response.data.createdGuild);
      }

      return null;
    },
    [guildCreate, loadMyGuild],
  );

  const invite = useCallback(
    async (id: string, message?: string): Promise<boolean> => {
      const response = await withSafeRetry(() => guildInviteCreate(id, message));

      if (!response || response.error || !response.data?.response?.id) {
        throw new Error(response?.error || 'Failed to send invite');
      }

      return true;
    },
    [guildInviteCreate],
  );

  const inviteRespond = useCallback(
    async (guildId: number, accept: boolean): Promise<boolean> => {
      const response = await withSafeRetry(() => guildInviteRespond(guildId, accept));

      if (!response || response.error || !response.data?.success) {
        throw new Error(response?.error || 'Failed to respond to invite');
      }

      try {
        await loadInvites(false);
      } catch (e) {
        // after guild join there is error
      }

      if (accept) {
        await loadMyGuild(false);
      }

      return true;
    },
    [guildInviteRespond, loadInvites, loadMyGuild],
  );

  const leave = useCallback(async (): Promise<boolean> => {
    const response = await withSafeRetry(() => guildLeave());

    if (!response || response.error || !response.data?.success) {
      throw new Error(response?.error || 'Failed to leave guild');
    }

    resetMyGuild();
    await loadMyGuild(false);

    return true;
  }, [guildLeave, loadMyGuild, resetMyGuild]);

  const deposit = useCallback(
    async (token: Token): Promise<boolean> => {
      const response = await withSafeRetry(() => guildDeposit(token.amount.toString()));

      if (!response || response.error || !response.data) {
        throw new Error(response?.error || 'Failed to deposit');
      }

      await loadMyGuild(false);

      return true;
    },
    [loadMyGuild, guildDeposit],
  );

  const update = useCallback(
    async (data: WebSocketMessageDataGuild): Promise<boolean> => {
      const response = await withSafeRetry(() => guildUpdateInfo(data));

      if (!response || response.error || !response.data?.updatedGuild) {
        throw new Error(response?.error || 'Failed to update guild');
      }

      await loadMyGuild(false);

      return true;
    },
    [guildUpdateInfo, loadMyGuild],
  );

  const transfer = useCallback(
    async (newLeaderId: string): Promise<boolean> => {
      const response = await withSafeRetry(() => guildUpdateLeader(newLeaderId));

      if (!response || response.error || !response.data?.success) {
        throw new Error(response?.error || 'Failed to transfer ownership');
      }

      await loadMyGuild(false);

      return true;
    },
    [guildUpdateLeader, loadMyGuild],
  );

  return (
    <GuildContext.Provider
      value={{
        loading,

        currentGuild,
        currentGuildHasLoaded,
        loadCurrentGuild,

        myGuild,
        myGuildHasLoadedOnce,
        myGuildMembersHasLoadedOnce,
        loadMyGuild,
        loadMyGuildMembers,

        topGuilds,
        topGuildsHasLoadedOnce,
        loadTopGuilds,

        currentSearchQuery,
        currentSearchGuilds,
        currentSearchGuildsHasLoaded,
        loadCurrentSearchGuilds,

        invites,
        invitesHasLoadedOnce,
        loadInvites,

        createCost,
        createCostHasLoadedOnce,
        loadCreateCost,

        upgradeCosts,
        upgradeCostsHasLoadedOnce,
        loadUpgradeCosts,

        create,
        invite,
        inviteRespond,
        leave,
        deposit,
        upgrade,
        update,
        transfer,
      }}
    >
      {children}
    </GuildContext.Provider>
  );
};

export const useGuild = (): IGuildContext => {
  const context = useContext(GuildContext);

  if (context === undefined) {
    throw new Error('useGuild must be used within a GuildProvider');
  }

  return context;
};
