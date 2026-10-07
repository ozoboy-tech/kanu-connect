CREATE TABLE `project_votes` (
  `project_id` BIGINT UNSIGNED NOT NULL,
  `voter_id` BIGINT UNSIGNED NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`project_id`, `voter_id`),
  KEY `idx_project_votes_voter` (`voter_id`),
  CONSTRAINT `fk_project_vote_project` FOREIGN KEY (`project_id`)
    REFERENCES `member_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_project_vote_voter` FOREIGN KEY (`voter_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
