-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'PIN_RESET');

-- CreateEnum
CREATE TYPE "AuthState" AS ENUM ('IDENTITY_VERIFIED', 'OTP_VERIFIED', 'PIN_SET', 'ACTIVE');

-- AlterTable
ALTER TABLE "UserAccount"
ADD COLUMN "authState" "AuthState" NOT NULL DEFAULT 'IDENTITY_VERIFIED',
ADD COLUMN "pinResetAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pinResetAllowedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VerificationCode"
ADD COLUMN "purpose" "OtpPurpose" NOT NULL DEFAULT 'REGISTER',
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "resendCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "AuthStateTransition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromState" "AuthState" NOT NULL,
    "toState" "AuthState" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthStateTransition_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AuthStateTransition" ADD CONSTRAINT "AuthStateTransition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
