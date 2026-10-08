CREATE TABLE `post_solutions` (
  `post_id` BIGINT UNSIGNED NOT NULL,
  `comment_id` BIGINT UNSIGNED NULL,
  `resolved` BOOLEAN NOT NULL DEFAULT FALSE,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`post_id`),
  KEY `idx_post_solutions_comment` (`comment_id`),
  CONSTRAINT `fk_post_solution_post` FOREIGN KEY (`post_id`)
    REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_post_solution_comment` FOREIGN KEY (`comment_id`)
    REFERENCES `post_comments` (`id`) ON DELETE SET NULL
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
