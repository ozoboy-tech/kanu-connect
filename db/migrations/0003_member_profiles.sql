CREATE TABLE `member_profiles` (
  `member_id` BIGINT UNSIGNED NOT NULL,
  `handle` VARCHAR(30)
    CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `photo_url` VARCHAR(2048) NULL,
  `bio` VARCHAR(500) NULL,
  `location` VARCHAR(120) NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`member_id`),
  UNIQUE KEY `uq_member_profiles_handle` (`handle`),
  CONSTRAINT `chk_member_profiles_handle`
    CHECK (REGEXP_LIKE(`handle`, '^[a-z0-9_]{3,30}$', 'c')),
  CONSTRAINT `fk_member_profile_member`
    FOREIGN KEY (`member_id`) REFERENCES `members` (`id`)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;