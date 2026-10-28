import example from "../examples/brightside-cleaning.audit.json";
import { validateProject, type Project } from "./model";
export function exampleProject(): Project {
  return validateProject(structuredClone(example));
}
