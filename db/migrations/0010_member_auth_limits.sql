CREATE TABLE `member_auth_limits` (
  `key_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `attempts` INT UNSIGNED NOT NULL,
  `reset_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`key_hash`)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
