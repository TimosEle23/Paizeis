import { Router } from "express";
import { z } from "zod";
import { createTeamSchema, emailField, teamNameField } from "@paizeis/shared";
import { authenticate, requireActor } from "../../middleware/authenticate.js";
import { pathParam, validateBody } from "../../middleware/validate.js";
import * as teams from "./service.js";

export const teamsRouter: Router = Router();

teamsRouter.use(authenticate);

teamsRouter.get("/", async (req, res) => {
  res.json(await teams.listMyTeams(requireActor(req)));
});

teamsRouter.post("/", validateBody(createTeamSchema), async (req, res) => {
  res.status(201).json(await teams.createTeam(requireActor(req), req.body));
});

// Everything below is scoped to one team, readable only by its members.
teamsRouter.get("/:id", async (req, res) => {
  res.json(await teams.getTeam(requireActor(req), pathParam(req, "id")));
});

teamsRouter.patch("/:id", validateBody(z.object({ name: teamNameField })), async (req, res) => {
  res.json(await teams.renameTeam(requireActor(req), pathParam(req, "id"), req.body.name));
});

teamsRouter.post("/:id/members", validateBody(z.object({ email: emailField })), async (req, res) => {
  res.status(201).json(await teams.addMember(requireActor(req), pathParam(req, "id"), req.body.email));
});

teamsRouter.delete("/:id/members/:userId", async (req, res) => {
  res.json(await teams.removeMember(requireActor(req), pathParam(req, "id"), pathParam(req, "userId")));
});

teamsRouter.post("/:id/leave", async (req, res) => {
  res.json(await teams.leaveTeam(requireActor(req), pathParam(req, "id")));
});

// Team chat.
teamsRouter.get("/:id/messages", async (req, res) => {
  res.json(await teams.listMessages(requireActor(req), pathParam(req, "id")));
});

teamsRouter.post(
  "/:id/messages",
  validateBody(z.object({ body: z.string().trim().min(1).max(2000) })),
  async (req, res) => {
    res.status(201).json(await teams.postMessage(requireActor(req), pathParam(req, "id"), req.body.body));
  },
);
