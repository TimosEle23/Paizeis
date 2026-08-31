import { Router } from "express";
import { availabilityQuerySchema, venueQuerySchema } from "@paizeis/shared";
import { parsed, validateQuery, pathParam } from "../../middleware/validate.js";
import { getAvailability } from "../availability/service.js";
import * as venues from "./service.js";

export const venuesRouter: Router = Router();

// All public. Signed-out visitors could browse venues on the old site, and
// there is no reason for a pitch listing to require an account.

venuesRouter.get("/", validateQuery(venueQuerySchema), async (_req, res) => {
  res.json(await venues.listVenues(parsed<typeof venueQuerySchema>(res, "query")));
});

venuesRouter.get("/cities", async (_req, res) => {
  res.json(await venues.listCities());
});

venuesRouter.get("/:id", async (req, res) => {
  res.json(await venues.getVenue(pathParam(req, "id")));
});

venuesRouter.get("/:id/availability", validateQuery(availabilityQuerySchema), async (req, res) => {
  res.json(await getAvailability(pathParam(req, "id"), parsed<typeof availabilityQuerySchema>(res, "query")));
});
