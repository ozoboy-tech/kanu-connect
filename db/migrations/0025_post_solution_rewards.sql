CREATE TABLE `post_solution_rewards` (
  `post_id` BIGINT UNSIGNED NOT NULL,
  `member_id` BIGINT UNSIGNED NOT NULL,
  `points` TINYINT UNSIGNED NOT NULL,
  `day_utc` DATE NOT NULL,
  `awarded_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`post_id`),
  KEY `idx_solution_reward_member_time` (`member_id`, `awarded_at`),
  CONSTRAINT `fk_solution_reward_post` FOREIGN KEY (`post_id`)
    REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_solution_reward_member` FOREIGN KEY (`member_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_solution_reward_points` CHECK (`points` <= 10)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
