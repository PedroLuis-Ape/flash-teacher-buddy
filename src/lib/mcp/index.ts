import { auth, defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";

const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "xrnfhhoxmmstagmelvyi";

export default defineMcp({
  name: "ape-piteco-mcp",
  title: "APE Piteco",
  version: "0.1.0",
  instructions:
    "Agent integration for APE Piteco. Use `echo` to verify connectivity. More tools will be added as the integration expands.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [echoTool],
});
