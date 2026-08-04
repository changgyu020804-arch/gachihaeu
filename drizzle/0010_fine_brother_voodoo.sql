ALTER TABLE `user_profiles` ADD `nickname_normalized` text;--> statement-breakpoint
UPDATE `user_profiles` AS `profile`
SET `nickname_normalized` = CASE
  WHEN trim(`nickname`) = '' THEN NULL
  WHEN rowid = (
    SELECT MIN(`candidate`.rowid)
    FROM `user_profiles` AS `candidate`
    WHERE lower(trim(`candidate`.`nickname`)) = lower(trim(`profile`.`nickname`))
  ) THEN lower(trim(`nickname`))
  ELSE '__legacy_duplicate__:' || rowid
END;--> statement-breakpoint
CREATE UNIQUE INDEX `user_profiles_nickname_normalized_idx` ON `user_profiles` (`nickname_normalized`);
