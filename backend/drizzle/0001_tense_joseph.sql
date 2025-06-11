ALTER TABLE "resumes" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "status" varchar(50) DEFAULT 'initiated';