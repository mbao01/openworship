/**
 * @module commands/projects
 *
 * Tauri command wrappers for service project management.
 * A service project is an ordered container for the content
 * (scriptures, songs, slides) used during a single worship service.
 */

import { invoke } from "../tauri";
import type { ServiceProject } from "../types";

/**
 * Creates a new service project with the given name.
 */
export async function createServiceProject(name: string): Promise<ServiceProject> {
  return invoke<ServiceProject>("create_service_project", { name });
}

/**
 * Returns all service projects, ordered by creation date (newest first).
 */
export async function listServiceProjects(): Promise<ServiceProject[]> {
  return invoke<ServiceProject[]>("list_service_projects");
}

/**
 * Returns the currently active (open) service project, or null if none.
 */
export async function getActiveProject(): Promise<ServiceProject | null> {
  return invoke<ServiceProject | null>("get_active_project");
}

/**
 * Opens an existing service project, making it the active context for
 * detection, queue operations, and display pushes.
 */
export async function openServiceProject(projectId: string): Promise<void> {
  return invoke("open_service_project", { projectId });
}

/**
 * Closes the currently active project. Detection continues but items
 * are no longer added to a project.
 */
export async function closeActiveProject(): Promise<void> {
  return invoke("close_active_project");
}

/**
 * Adds a scripture or content item to the active project's ordered list.
 */
export async function addItemToActiveProject(
  reference: string,
  text: string,
  translation: string,
): Promise<void> {
  return invoke("add_item_to_active_project", { reference, text, translation });
}

/**
 * Removes an item from the active project by its item ID.
 */
export async function removeItemFromActiveProject(itemId: string): Promise<void> {
  return invoke("remove_item_from_active_project", { itemId });
}

/**
 * Reorders the items in the active project.
 * @param itemIds Ordered array of item IDs representing the new order.
 */
export async function reorderActiveProjectItems(itemIds: string[]): Promise<void> {
  return invoke("reorder_active_project_items", { itemIds });
}
