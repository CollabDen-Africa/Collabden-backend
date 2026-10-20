const prisma = require("../../../config/prismaClient");
const { publishEvent } = require("../../../events/publisher");
const EVENT_TYPES = require("../../../events/eventTypes");

const TASK_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"];
const MAX_TITLE_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_COMMENT_LENGTH = 2000;

const USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  legalName: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
};

const TASK_INCLUDE = {
  createdBy: { select: USER_SELECT },
  assignees: { include: { user: { select: USER_SELECT } } },
  _count: { select: { comments: true } },
};

const COMMENT_INCLUDE = {
  author: { select: USER_SELECT },
};

const httpError = (message, status, code) => {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
};

const assertProjectAccess = async (projectId, userId) => {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      isDeleted: false,
      OR: [
        { ownerId: userId },
        { collaborators: { some: { userId, isActive: true } } },
      ],
    },
    select: {
      id: true,
      name: true,
      ownerId: true,
      collaborators: {
        where: { isActive: true },
        select: { userId: true },
      },
    },
  });
  if (!project) {
    throw httpError("Project not found or you do not have access to its tasks.", 404);
  }
  return project;
};

const activeMemberIds = (project) => {
  const ids = new Set([project.ownerId]);
  for (const c of project.collaborators) ids.add(c.userId);
  return ids;
};

const displayName = (user) =>
  user?.displayName ||
  user?.legalName ||
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
  user?.email ||
  "A collaborator";

const validateAssignees = (assigneeIds, project) => {
  if (!assigneeIds) return [];
  if (!Array.isArray(assigneeIds)) {
    throw httpError("assigneeIds must be an array of user IDs.", 400);
  }
  const unique = Array.from(new Set(assigneeIds.filter((v) => typeof v === "string" && v.trim())));
  const members = activeMemberIds(project);
  for (const id of unique) {
    if (!members.has(id)) {
      throw httpError(`User ${id} is not an active collaborator on this project.`, 400);
    }
  }
  return unique;
};

const validateTitle = (title) => {
  if (typeof title !== "string" || !title.trim()) {
    throw httpError("Task title is required.", 400);
  }
  if (title.trim().length > MAX_TITLE_LENGTH) {
    throw httpError(`Task title cannot exceed ${MAX_TITLE_LENGTH} characters.`, 400);
  }
  return title.trim();
};

const validateDescription = (description) => {
  if (description === undefined || description === null) return null;
  if (typeof description !== "string") throw httpError("description must be a string.", 400);
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw httpError(`Task description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`, 400);
  }
  return description.trim() || null;
};

const validateDueDate = (dueDate) => {
  if (dueDate === undefined) return undefined;
  if (dueDate === null || dueDate === "") return null;
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) throw httpError("dueDate is invalid.", 400);
  return parsed;
};

const validateStatus = (status) => {
  if (!TASK_STATUSES.includes(status)) {
    throw httpError(`status must be one of: ${TASK_STATUSES.join(", ")}.`, 400);
  }
  return status;
};

const validatePriority = (priority) => {
  if (!TASK_PRIORITIES.includes(priority)) {
    throw httpError(`priority must be one of: ${TASK_PRIORITIES.join(", ")}.`, 400);
  }
  return priority;
};

const createTask = async (projectId, userId, input = {}) => {
  const project = await assertProjectAccess(projectId, userId);

  const title = validateTitle(input.title);
  const description = validateDescription(input.description);
  const dueDate = validateDueDate(input.dueDate);
  const status = input.status ? validateStatus(input.status) : "TODO";
  const priority = input.priority ? validatePriority(input.priority) : "MEDIUM";
  const assigneeIds = validateAssignees(input.assigneeIds, project);

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.projectTask.create({
      data: {
        projectId,
        createdById: userId,
        title,
        description,
        status,
        priority,
        dueDate: dueDate === undefined ? null : dueDate,
        assignees: assigneeIds.length
          ? { createMany: { data: assigneeIds.map((assigneeUserId) => ({ userId: assigneeUserId })) } }
          : undefined,
      },
      include: TASK_INCLUDE,
    });

    await tx.activityLog.create({
      data: {
        projectId,
        action: "TASK_CREATED",
        details: `Task "${title}" was created.`,
      },
    });

    return created;
  });

  if (assigneeIds.length) {
    await publishEvent(EVENT_TYPES.TASK_ASSIGNED, {
      projectId,
      projectName: project.name,
      taskId: task.id,
      taskTitle: task.title,
      actorId: userId,
      actorName: displayName(task.createdBy),
      assigneeIds,
    });
  }

  return task;
};

const listTasks = async (projectId, userId, { status, priority, assigneeId, groupBy } = {}) => {
  await assertProjectAccess(projectId, userId);

  const where = { projectId };
  if (status) where.status = validateStatus(status);
  if (priority) where.priority = validatePriority(priority);
  if (assigneeId) where.assignees = { some: { userId: assigneeId } };

  const tasks = await prisma.projectTask.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: TASK_INCLUDE,
  });

  if (groupBy === "status") {
    const grouped = TASK_STATUSES.reduce((acc, s) => ({ ...acc, [s]: [] }), {});
    for (const t of tasks) grouped[t.status].push(t);
    return { board: grouped, total: tasks.length };
  }
  return { tasks, total: tasks.length };
};

const getTaskDetails = async (projectId, taskId, userId) => {
  await assertProjectAccess(projectId, userId);
  const task = await prisma.projectTask.findFirst({
    where: { id: taskId, projectId },
    include: {
      ...TASK_INCLUDE,
      comments: {
        orderBy: { createdAt: "asc" },
        include: COMMENT_INCLUDE,
      },
    },
  });
  if (!task) throw httpError("Task not found in this project.", 404);
  return task;
};

const updateTask = async (projectId, taskId, userId, patch = {}) => {
  const project = await assertProjectAccess(projectId, userId);

  const existing = await prisma.projectTask.findFirst({
    where: { id: taskId, projectId },
    include: TASK_INCLUDE,
  });
  if (!existing) throw httpError("Task not found in this project.", 404);

  const data = {};
  const changes = [];

  if (patch.title !== undefined) {
    const next = validateTitle(patch.title);
    if (next !== existing.title) {
      data.title = next;
      changes.push(`title → "${next}"`);
    }
  }
  if (patch.description !== undefined) {
    const next = validateDescription(patch.description);
    if (next !== existing.description) {
      data.description = next;
      changes.push("description updated");
    }
  }
  if (patch.dueDate !== undefined) {
    const next = validateDueDate(patch.dueDate);
    data.dueDate = next === undefined ? null : next;
    changes.push(data.dueDate ? `due ${data.dueDate.toISOString().slice(0, 10)}` : "due date cleared");
  }
  if (patch.priority !== undefined) {
    const next = validatePriority(patch.priority);
    if (next !== existing.priority) {
      data.priority = next;
      changes.push(`priority → ${next}`);
    }
  }

  let statusChange = null;
  if (patch.status !== undefined) {
    const next = validateStatus(patch.status);
    if (next !== existing.status) {
      data.status = next;
      statusChange = { from: existing.status, to: next };
      changes.push(`status → ${next}`);
    }
  }

  let newAssigneeIds = null;
  if (patch.assigneeIds !== undefined) {
    newAssigneeIds = validateAssignees(patch.assigneeIds, project);
  }

  if (Object.keys(data).length === 0 && newAssigneeIds === null) {
    return existing;
  }

  const existingAssigneeIds = new Set(existing.assignees.map((a) => a.userId));
  const added = newAssigneeIds ? newAssigneeIds.filter((id) => !existingAssigneeIds.has(id)) : [];
  const removed = newAssigneeIds
    ? Array.from(existingAssigneeIds).filter((id) => !newAssigneeIds.includes(id))
    : [];

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.projectTask.update({
      where: { id: taskId },
      data,
      include: TASK_INCLUDE,
    });

    if (newAssigneeIds !== null) {
      if (removed.length) {
        await tx.taskAssignee.deleteMany({
          where: { taskId, userId: { in: removed } },
        });
      }
      if (added.length) {
        await tx.taskAssignee.createMany({
          data: added.map((userId2) => ({ taskId, userId: userId2 })),
          skipDuplicates: true,
        });
      }
    }

    if (statusChange) {
      await tx.activityLog.create({
        data: {
          projectId,
          action: "TASK_STATUS_UPDATED",
          details: `Task "${result.title}" moved to ${statusChange.to.replace("_", " ").toLowerCase()}.`,
        },
      });
    }

    if (added.length || removed.length) {
      await tx.activityLog.create({
        data: {
          projectId,
          action: "TASK_REASSIGNED",
          details: `Assignees on "${result.title}" changed (+${added.length} / -${removed.length}).`,
        },
      });
    }

    if (changes.length && !statusChange && !added.length && !removed.length) {
      await tx.activityLog.create({
        data: {
          projectId,
          action: "TASK_UPDATED",
          details: `Task "${result.title}": ${changes.join(", ")}.`,
        },
      });
    }

    return result;
  });

  const refreshed = await prisma.projectTask.findUnique({
    where: { id: taskId },
    include: TASK_INCLUDE,
  });

  if (added.length) {
    await publishEvent(EVENT_TYPES.TASK_ASSIGNED, {
      projectId,
      projectName: project.name,
      taskId,
      taskTitle: refreshed.title,
      actorId: userId,
      actorName: displayName(refreshed.createdBy),
      assigneeIds: added,
    });
  }

  if (statusChange) {
    const notifyUserIds = Array.from(
      new Set([
        refreshed.createdById,
        ...refreshed.assignees.map((a) => a.userId),
      ].filter((id) => id && id !== userId))
    );
    await publishEvent(EVENT_TYPES.TASK_STATUS_CHANGED, {
      projectId,
      projectName: project.name,
      taskId,
      taskTitle: refreshed.title,
      actorId: userId,
      from: statusChange.from,
      to: statusChange.to,
      recipientIds: notifyUserIds,
    });
  }

  if (changes.length) {
    await publishEvent(EVENT_TYPES.TASK_UPDATED, {
      projectId,
      taskId,
      changes,
      actorId: userId,
    });
  }

  return refreshed;
};

const deleteTask = async (projectId, taskId, userId) => {
  const project = await assertProjectAccess(projectId, userId);
  const task = await prisma.projectTask.findFirst({
    where: { id: taskId, projectId },
    select: { id: true, title: true, createdById: true },
  });
  if (!task) throw httpError("Task not found in this project.", 404);
  if (task.createdById !== userId && project.ownerId !== userId) {
    throw httpError("Only the task creator or project owner can delete this task.", 403);
  }
  await prisma.projectTask.delete({ where: { id: taskId } });
  await prisma.activityLog.create({
    data: {
      projectId,
      action: "TASK_DELETED",
      details: `Task "${task.title}" was deleted.`,
    },
  });
  return { success: true };
};

const addTaskComment = async (projectId, taskId, userId, { content, parentId } = {}) => {
  const project = await assertProjectAccess(projectId, userId);

  const text = typeof content === "string" ? content.trim() : "";
  if (!text) throw httpError("Comment content is required.", 400);
  if (text.length > MAX_COMMENT_LENGTH) {
    throw httpError(`Comment cannot exceed ${MAX_COMMENT_LENGTH} characters.`, 400);
  }

  const task = await prisma.projectTask.findFirst({
    where: { id: taskId, projectId },
    include: {
      assignees: { select: { userId: true } },
    },
  });
  if (!task) throw httpError("Task not found in this project.", 404);

  if (parentId) {
    const parent = await prisma.taskComment.findUnique({
      where: { id: parentId },
      select: { taskId: true },
    });
    if (!parent || parent.taskId !== taskId) {
      throw httpError("Reply target comment was not found on this task.", 400);
    }
  }

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.taskComment.create({
      data: {
        taskId,
        authorId: userId,
        content: text,
        parentId: parentId || null,
      },
      include: COMMENT_INCLUDE,
    });
    await tx.activityLog.create({
      data: {
        projectId,
        action: "TASK_COMMENT_ADDED",
        details: `${displayName(created.author)} commented on "${task.title}".`,
      },
    });
    return created;
  });

  const notifyUserIds = Array.from(
    new Set(
      [task.createdById, ...task.assignees.map((a) => a.userId)].filter(
        (id) => id && id !== userId
      )
    )
  );
  await publishEvent(EVENT_TYPES.TASK_COMMENT_ADDED, {
    projectId,
    projectName: project.name,
    taskId,
    taskTitle: task.title,
    commentId: comment.id,
    authorId: userId,
    authorName: displayName(comment.author),
    recipientIds: notifyUserIds,
  });

  return comment;
};

const listTaskComments = async (projectId, taskId, userId) => {
  await assertProjectAccess(projectId, userId);
  const task = await prisma.projectTask.findFirst({
    where: { id: taskId, projectId },
    select: { id: true },
  });
  if (!task) throw httpError("Task not found in this project.", 404);
  return prisma.taskComment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    include: COMMENT_INCLUDE,
  });
};

const deleteTaskComment = async (projectId, taskId, commentId, userId) => {
  const project = await assertProjectAccess(projectId, userId);
  const comment = await prisma.taskComment.findFirst({
    where: { id: commentId, taskId },
    select: { id: true, authorId: true, task: { select: { title: true, projectId: true } } },
  });
  if (!comment || comment.task.projectId !== projectId) {
    throw httpError("Comment not found on this task.", 404);
  }
  if (comment.authorId !== userId && project.ownerId !== userId) {
    throw httpError("Only the comment author or project owner can delete this comment.", 403);
  }
  await prisma.taskComment.delete({ where: { id: commentId } });
  await prisma.activityLog.create({
    data: {
      projectId,
      action: "TASK_COMMENT_DELETED",
      details: `A comment on "${comment.task.title}" was deleted.`,
    },
  });
  return { success: true };
};

module.exports = {
  createTask,
  listTasks,
  getTaskDetails,
  updateTask,
  deleteTask,
  addTaskComment,
  listTaskComments,
  deleteTaskComment,
  TASK_STATUSES,
  TASK_PRIORITIES,
};
