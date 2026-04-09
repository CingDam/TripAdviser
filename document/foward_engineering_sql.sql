-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema tripit
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema tripit
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `tripit` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ;
USE `tripit` ;

-- -----------------------------------------------------
-- Table `tripit`.`tb_user`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `tripit`.`tb_user` (
  `user_num` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(15) NOT NULL,
  `id` VARCHAR(45) NOT NULL,
  `pw` VARCHAR(255) NOT NULL,
  `profile_img` VARCHAR(255) NULL,
  `created_at` DATETIME NULL DEFAULT NOW(),
  PRIMARY KEY (`user_num`),
  UNIQUE INDEX `id_UNIQUE` (`id` ASC) VISIBLE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `tripit`.`tb_city`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `tripit`.`tb_city` (
  `city_num` INT NOT NULL AUTO_INCREMENT,
  `city_name` VARCHAR(50) NOT NULL,
  `country` VARCHAR(50) NOT NULL,
  `lat` DOUBLE NOT NULL,
  `lng` DOUBLE NOT NULL,
  `image_url` VARCHAR(255) NULL,
  `plan_count` INT NULL DEFAULT 0,
  `created_at` DATETIME NULL DEFAULT NOW(),
  PRIMARY KEY (`city_num`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `tripit`.`tb_plan`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `tripit`.`tb_plan` (
  `plan_num` INT NOT NULL AUTO_INCREMENT,
  `user_num` INT NOT NULL,
  `city_num` INT NULL,
  `plan_name` VARCHAR(45) NOT NULL,
  `start_date` DATE NULL,
  `end_date` DATE NULL,
  `is_public` TINYINT(1) NULL DEFAULT 0,
  `created_at` DATETIME NULL DEFAULT NOW(),
  `updated_at` DATETIME NULL DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`plan_num`),
  INDEX `fk_tb_plan_tb_user_idx` (`user_num` ASC) VISIBLE,
  INDEX `fk_tb_plan_tb_city1_idx` (`city_num` ASC) VISIBLE,
  CONSTRAINT `fk_tb_plan_tb_user`
    FOREIGN KEY (`user_num`)
    REFERENCES `tripit`.`tb_user` (`user_num`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_tb_plan_tb_city`
    FOREIGN KEY (`city_num`)
    REFERENCES `tripit`.`tb_city` (`city_num`)
    ON DELETE SET NULL
    ON UPDATE SET NULL)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `tripit`.`tb_day_plan`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `tripit`.`tb_day_plan` (
  `day_plan_num` INT NOT NULL AUTO_INCREMENT,
  `plan_num` INT NOT NULL,
  `plan_date` DATE NOT NULL,
  `sort_order` INT NULL DEFAULT 0,
  `place_id` VARCHAR(100) NULL,
  `location_name` VARCHAR(50) NULL,
  `address` VARCHAR(100) NULL,
  `lat` DOUBLE NULL,
  `lng` DOUBLE NULL,
  `tel` VARCHAR(20) NULL,
  `created_at` DATETIME NULL DEFAULT NOW(),
  PRIMARY KEY (`day_plan_num`),
  INDEX `fk_tb_day_plan_tb_plan1_idx` (`plan_num` ASC) VISIBLE,
  CONSTRAINT `fk_tb_day_plan_tb_plan1`
    FOREIGN KEY (`plan_num`)
    REFERENCES `tripit`.`tb_plan` (`plan_num`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `tripit`.`tb_community`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `tripit`.`tb_community` (
  `community_num` INT NOT NULL AUTO_INCREMENT,
  `user_num` INT NOT NULL,
  `city_num` INT NULL,
  `title` VARCHAR(100) NOT NULL,
  `content` TEXT NOT NULL,
  `view_count` INT NULL DEFAULT 0,
  `created_at` DATETIME NULL DEFAULT NOW(),
  `updated_at` DATETIME NULL DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`community_num`),
  INDEX `fk_tb_community_tb_user1_idx` (`user_num` ASC) VISIBLE,
  INDEX `fk_tb_community_tb_city1_idx` (`city_num` ASC) VISIBLE,
  CONSTRAINT `fk_tb_community_tb_user1`
    FOREIGN KEY (`user_num`)
    REFERENCES `tripit`.`tb_user` (`user_num`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_tb_community_tb_city1`
    FOREIGN KEY (`city_num`)
    REFERENCES `tripit`.`tb_city` (`city_num`)
    ON DELETE SET NULL
    ON UPDATE SET NULL)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `tripit`.`tb_comment`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `tripit`.`tb_comment` (
  `comment_num` INT NOT NULL AUTO_INCREMENT,
  `community_num` INT NOT NULL,
  `user_num` INT NOT NULL,
  `parent_comment_num` INT NULL,
  `content` TEXT NOT NULL,
  `created_at` DATETIME NULL DEFAULT NOW(),
  PRIMARY KEY (`comment_num`),
  INDEX `fk_tb_comment_tb_community2_idx` (`community_num` ASC) VISIBLE,
  INDEX `fk_tb_comment_tb_user2_idx` (`user_num` ASC) VISIBLE,
  INDEX `fk_comment_parent_idx` (`parent_comment_num` ASC) VISIBLE,
  CONSTRAINT `fk_tb_comment_tb_community2`
    FOREIGN KEY (`community_num`)
    REFERENCES `tripit`.`tb_community` (`community_num`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_tb_comment_tb_user`
    FOREIGN KEY (`user_num`)
    REFERENCES `tripit`.`tb_user` (`user_num`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_comment_parent`
    FOREIGN KEY (`parent_comment_num`)
    REFERENCES `tripit`.`tb_comment` (`comment_num`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `tripit`.`tb_community_like`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `tripit`.`tb_community_like` (
  `like_num` INT NOT NULL AUTO_INCREMENT,
  `community_num` INT NOT NULL,
  `user_num` INT NOT NULL,
  `created_at` DATETIME NULL DEFAULT NOW(),
  PRIMARY KEY (`like_num`),
  INDEX `fk_tb_comment_tb_community1_idx` (`community_num` ASC) VISIBLE,
  INDEX `fk_tb_comment_tb_user1_idx` (`user_num` ASC) VISIBLE,
  UNIQUE INDEX `uq_community_like` (`community_num` ASC, `user_num` ASC) VISIBLE,
  CONSTRAINT `fk_tb_comment_tb_community1`
    FOREIGN KEY (`community_num`)
    REFERENCES `tripit`.`tb_community` (`community_num`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_tb_comment_tb_user1`
    FOREIGN KEY (`user_num`)
    REFERENCES `tripit`.`tb_user` (`user_num`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `tripit`.`tb_review`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `tripit`.`tb_review` (
  `review_num` INT NOT NULL AUTO_INCREMENT,
  `user_num` INT NOT NULL,
  `city_num` INT NULL,
  `place_id` VARCHAR(100) NULL,
  `location_name` VARCHAR(50) NULL,
  `rating` INT NOT NULL,
  `content` TEXT NULL,
  `created_at` DATETIME NULL DEFAULT NOW(),
  `updated_at` DATETIME NULL DEFAULT NOW() ON UPDATE NOW(),
  PRIMARY KEY (`review_num`),
  INDEX `fk_tb_review_tb_user1_idx` (`user_num` ASC) VISIBLE,
  INDEX `fk_tb_review_tb_city1_idx` (`city_num` ASC) VISIBLE,
  CONSTRAINT `fk_tb_review_tb_user`
    FOREIGN KEY (`user_num`)
    REFERENCES `tripit`.`tb_user` (`user_num`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_tb_review_tb_city`
    FOREIGN KEY (`city_num`)
    REFERENCES `tripit`.`tb_city` (`city_num`)
    ON DELETE SET NULL
    ON UPDATE SET NULL)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `tripit`.`tb_review_like`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `tripit`.`tb_review_like` (
  `like_num` INT NOT NULL AUTO_INCREMENT,
  `review_num` INT NOT NULL,
  `user_num` INT NOT NULL,
  `created_at` DATETIME NULL DEFAULT NOW(),
  PRIMARY KEY (`like_num`),
  INDEX `fk_tb_review_like_tb_review1_idx` (`review_num` ASC) VISIBLE,
  INDEX `fk_tb_review_like_tb_user1_idx` (`user_num` ASC) VISIBLE,
  UNIQUE INDEX `uq_review_like` (`review_num` ASC, `user_num` ASC) VISIBLE,
  CONSTRAINT `fk_tb_review_like_tb_review1`
    FOREIGN KEY (`review_num`)
    REFERENCES `tripit`.`tb_review` (`review_num`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_tb_review_like_tb_user1`
    FOREIGN KEY (`user_num`)
    REFERENCES `tripit`.`tb_user` (`user_num`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `tripit`.`tb_chat_room`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `tripit`.`tb_chat_room` (
  `room_num` INT NOT NULL AUTO_INCREMENT,
  `room_name` VARCHAR(100) NULL,
  `room_type` ENUM('private', 'open') NULL DEFAULT 'private',
  `created_at` DATETIME NULL DEFAULT NOW(),
  PRIMARY KEY (`room_num`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `tripit`.`tb_chat_room_member`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `tripit`.`tb_chat_room_member` (
  `member_num` INT NOT NULL AUTO_INCREMENT,
  `room_num` INT NOT NULL,
  `user_num` INT NOT NULL,
  `joined_at` DATETIME NULL DEFAULT NOW(),
  `last_read_at` DATETIME NULL,
  INDEX `fk_tb_chat_room_member_tb_chat_room1_idx` (`room_num` ASC) VISIBLE,
  INDEX `fk_tb_chat_room_member_tb_user1_idx` (`user_num` ASC) VISIBLE,
  PRIMARY KEY (`member_num`),
  UNIQUE INDEX `uq_room_member` (`room_num` ASC, `user_num` ASC) VISIBLE,
  CONSTRAINT `fk_tb_chat_room_member_tb_chat_room1`
    FOREIGN KEY (`room_num`)
    REFERENCES `tripit`.`tb_chat_room` (`room_num`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_tb_chat_room_member_tb_user1`
    FOREIGN KEY (`user_num`)
    REFERENCES `tripit`.`tb_user` (`user_num`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;

INSERT INTO `tripit`.`tb_city` (city_name, country, lat, lng) VALUES
('서울', '한국', 37.5665, 126.9780),
('부산', '한국', 35.1796, 129.0756),
('제주', '한국', 33.4996, 126.5312),
('도쿄', '일본', 35.6762, 139.6503),
('오사카', '일본', 34.6937, 135.5023),
('후쿠오카', '일본', 33.5904, 130.4017),
('교토', '일본', 35.0116, 135.7681),
('삿포로', '일본', 43.0618, 141.3545),
('방콕', '태국', 13.7563, 100.5018),
('싱가포르', '싱가포르', 1.3521, 103.8198),
('발리', '인도네시아', -8.3405, 115.0920),
('다낭', '베트남', 16.0544, 108.2022),
('파리', '프랑스', 48.8566, 2.3522),
('로마', '이탈리아', 41.9028, 12.4964),
('바르셀로나', '스페인', 41.3851, 2.1734);