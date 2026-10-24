-- CreateTable
CREATE TABLE "ExampleItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExampleItem_pkey" PRIMARY KEY ("id")
);
