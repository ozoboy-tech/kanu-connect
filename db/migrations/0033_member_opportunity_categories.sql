CREATE TABLE `member_opportunity_categories` (
  `member_id` BIGINT UNSIGNED NOT NULL,
  `category` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`member_id`, `category`),
  KEY `idx_category_members` (`category`, `member_id`),
  CONSTRAINT `fk_opportunity_category_member` FOREIGN KEY (`member_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_member_opportunity_category` CHECK (
    `category` IN ('frontend', 'backend', 'mobile', 'data-ai',
      'devops-cloud', 'design', 'security', 'other')
  )
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
