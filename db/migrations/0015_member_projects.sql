CREATE TABLE `member_projects` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `public_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `member_id` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `summary` VARCHAR(300) NOT NULL,
  `description` TEXT NOT NULL,
  `status` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `technologies` JSON NOT NULL,
  `repository_url` VARCHAR(500) NULL,
  `demo_url` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_member_projects_public_id` (`public_id`),
  KEY `idx_member_projects_recent` (`deleted_at`, `created_at`, `id`),
  KEY `idx_member_projects_author` (`member_id`, `deleted_at`, `created_at`),
  CONSTRAINT `fk_member_project_author` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`),
  CONSTRAINT `chk_member_project_status` CHECK (`status` IN ('idea', 'building', 'live')),
  CONSTRAINT `chk_member_project_title` CHECK (CHAR_LENGTH(TRIM(`title`)) > 0),
  CONSTRAINT `chk_member_project_summary` CHECK (CHAR_LENGTH(TRIM(`summary`)) > 0),
  CONSTRAINT `chk_member_project_description` CHECK (CHAR_LENGTH(TRIM(`description`)) > 0),
  CONSTRAINT `chk_member_project_technologies` CHECK (
    JSON_TYPE(`technologies`) = 'ARRAY' AND JSON_LENGTH(`technologies`) BETWEEN 1 AND 8
  )
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;