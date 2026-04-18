/**
 * Central registry of all event types used in the Redis Pub/Sub system.
 * Add new event types here as the application grows.
 */
const EVENT_TYPES = {
  PROJECT_CREATED: "PROJECT_CREATED",
  COLLABORATOR_INVITED: "COLLABORATOR_INVITED",
  TASK_ASSIGNED: "TASK_ASSIGNED",
};

module.exports = EVENT_TYPES;
