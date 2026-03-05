import { Hono } from "hono";
import { handleParse, handleValidate, handleExport, handleListBands, handleListSkills } from "./handlers";

export const apiRoutes = new Hono();

apiRoutes.get("/bands", handleListBands);
apiRoutes.get("/skills", handleListSkills);
apiRoutes.post("/parse", handleParse);
apiRoutes.post("/validate", handleValidate);
apiRoutes.post("/export", handleExport);
