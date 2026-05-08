/**
 * Central registry of all event types used in the Redis Pub/Sub system.
 * Add new event types here as the application grows.
 */
const EVENT_TYPES = {
  PROJECT_CREATED: "PROJECT_CREATED",
  PROJECT_UPDATED: "PROJECT_UPDATED",
  PROJECT_DELETED: "PROJECT_DELETED",
  COLLABORATOR_INVITED: "COLLABORATOR_INVITED",
  COLLABORATOR_REMOVED: "COLLABORATOR_REMOVED",
  TASK_ASSIGNED: "TASK_ASSIGNED",
};

module.exports = EVENT_TYPES;
