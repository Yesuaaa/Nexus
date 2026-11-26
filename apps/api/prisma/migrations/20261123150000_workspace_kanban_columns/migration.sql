CREATE TABLE "WorkspaceKanbanColumn" (
    "id" TEXT NOT NULL,
    "workspaceKey" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "WorkspaceKanbanColumn_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkspaceKanbanColumn_workspaceKey_position_key" ON "WorkspaceKanbanColumn"("workspaceKey", "position");
CREATE UNIQUE INDEX "WorkspaceKanbanColumn_workspaceKey_id_key" ON "WorkspaceKanbanColumn"("workspaceKey", "id");
CREATE INDEX "WorkspaceKanbanColumn_workspaceKey_idx" ON "WorkspaceKanbanColumn"("workspaceKey");
CREATE TABLE "WorkspaceKanbanAssignment" (
    "workspaceKey" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    CONSTRAINT "WorkspaceKanbanAssignment_pkey" PRIMARY KEY ("workspaceKey", "projectId", "taskId"),
    CONSTRAINT "WorkspaceKanbanAssignment_columnId_fkey" FOREIGN KEY ("workspaceKey", "columnId") REFERENCES "WorkspaceKanbanColumn"("workspaceKey", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WorkspaceKanbanAssignment_columnId_idx" ON "WorkspaceKanbanAssignment"("columnId");
