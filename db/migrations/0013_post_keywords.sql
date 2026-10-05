CREATE TABLE `post_keywords` (
  `post_id` BIGINT UNSIGNED NOT NULL,
  `keyword` VARCHAR(32) NOT NULL,

  PRIMARY KEY (`post_id`, `keyword`),
  CONSTRAINT `chk_post_keyword` CHECK (CHAR_LENGTH(TRIM(`keyword`)) > 0),
  CONSTRAINT `fk_post_keyword_post`
    FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;