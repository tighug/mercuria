import ky from "ky";

export const api = ky.create({
  prefixUrl: "/api",
  credentials: "include",
  hooks: {
    afterResponse: [
      async (request, options, response) => {
        if (response.status === 401 && !request.url.includes("/auth/refresh")) {
          const refreshRes = await ky.post("/api/auth/refresh", { credentials: "include" });
          if (refreshRes.ok) {
            return ky(request, options);
          }
        }
        return response;
      },
    ],
  },
});
