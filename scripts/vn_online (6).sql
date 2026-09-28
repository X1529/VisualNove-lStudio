-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 24, 2026 at 05:45 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `vn_online`
--

-- --------------------------------------------------------

--
-- Table structure for table `assets`
--

CREATE TABLE `assets` (
  `asset_id` int(11) NOT NULL,
  `story_id` int(11) NOT NULL DEFAULT 1,
  `chapter_id` int(11) DEFAULT NULL,
  `asset_type` enum('character','background','bgm','sfx') NOT NULL,
  `asset_name` varchar(150) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `mime_type` varchar(120) DEFAULT NULL,
  `size_bytes` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `user_id` int(11) DEFAULT NULL,
  `guest_id` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `assets`
--

INSERT INTO `assets` (`asset_id`, `story_id`, `chapter_id`, `asset_type`, `asset_name`, `file_name`, `file_path`, `mime_type`, `size_bytes`, `created_at`, `updated_at`, `user_id`, `guest_id`) VALUES
(2, 1, NULL, 'background', 'sd', 'Screenshot 2025-09-03 235130.png', '/assets/backgrounds/1786614046210-388782503-Screenshot_2025-09-03_235130.png', 'image/png', 2486999, '2026-08-13 09:40:46', '2026-08-13 09:40:46', NULL, NULL),
(3, 1, NULL, 'bgm', 'SW', 'Space Walk.mp3', '/assets/bgm/1787023231195-875109466-Space_Walk.mp3', 'audio/mpeg', 2006686, '2026-08-18 03:20:31', '2026-08-18 03:20:31', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `chapters`
--

CREATE TABLE `chapters` (
  `chapter_id` int(11) NOT NULL,
  `story_id` int(11) NOT NULL,
  `chapter_number` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `user_id` int(11) DEFAULT NULL,
  `guest_id` varchar(255) DEFAULT NULL,
  `is_exported` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `chapters`
--

INSERT INTO `chapters` (`chapter_id`, `story_id`, `chapter_number`, `title`, `description`, `created_at`, `updated_at`, `user_id`, `guest_id`, `is_exported`) VALUES
(5, 3, 1, 'fffs', NULL, '2026-08-13 09:39:02', '2026-08-13 09:39:02', NULL, NULL, 0);

-- --------------------------------------------------------

--
-- Table structure for table `dialogues`
--

CREATE TABLE `dialogues` (
  `dialogue_id` int(11) NOT NULL,
  `chapter_id` int(11) NOT NULL,
  `sort_order` int(11) DEFAULT 0,
  `speaker_name` varchar(100) DEFAULT NULL,
  `identity` varchar(100) DEFAULT NULL,
  `dialogue_text` longtext DEFAULT NULL,
  `type` varchar(50) DEFAULT 'normal',
  `speaker_position` varchar(50) DEFAULT 'center',
  `bg` int(11) DEFAULT NULL,
  `bgm` int(11) DEFAULT NULL,
  `sfx` int(11) DEFAULT NULL,
  `characters_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`characters_json`)),
  `choices_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`choices_json`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `dialogues`
--

INSERT INTO `dialogues` (`dialogue_id`, `chapter_id`, `sort_order`, `speaker_name`, `identity`, `dialogue_text`, `type`, `speaker_position`, `bg`, `bgm`, `sfx`, `characters_json`, `choices_json`, `created_at`, `updated_at`) VALUES
(3, 5, 2, 'เปรม', NULL, 'sadad', 'normal', 'center', NULL, 3, NULL, '[{\"asset_id\":null,\"position\":\"left\"},{\"asset_id\":null,\"position\":\"center\"}]', '[]', '2026-08-13 09:40:31', '2026-08-18 06:15:33'),
(4, 5, 1, 'เปรม', NULL, 'แ', 'normal', 'left', NULL, NULL, NULL, '[{\"asset_id\":4,\"position\":\"left\"}]', '[]', '2026-08-13 09:56:05', '2026-08-18 06:17:28'),
(5, 5, 2, 'ff', NULL, 'ค', 'normal', 'center', 2, NULL, NULL, '[{\"asset_id\":1,\"position\":\"center\"}]', '[]', '2026-08-13 09:56:44', '2026-08-13 09:56:44');

-- --------------------------------------------------------

--
-- Table structure for table `stories`
--

CREATE TABLE `stories` (
  `story_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `cover_url` varchar(500) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `user_id` int(11) DEFAULT NULL,
  `guest_id` varchar(255) DEFAULT NULL,
  `is_published` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `stories`
--

INSERT INTO `stories` (`story_id`, `title`, `cover_url`, `description`, `created_at`, `updated_at`, `user_id`, `guest_id`, `is_published`) VALUES
(3, 'fff', NULL, NULL, '2026-08-13 09:38:58', '2026-08-13 09:38:58', NULL, NULL, 0);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `google_id` varchar(255) DEFAULT NULL,
  `display_name` varchar(150) DEFAULT NULL,
  `avatar_url` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `email`, `password_hash`, `google_id`, `display_name`, `avatar_url`, `created_at`, `updated_at`) VALUES
(1, 'mock@gmail.com', NULL, '123456789', 'Mock User', NULL, '2026-09-15 04:16:14', '2026-09-15 04:16:14');

-- --------------------------------------------------------

--
-- Table structure for table `user_providers`
--

CREATE TABLE `user_providers` (
  `provider_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `provider_name` varchar(50) NOT NULL,
  `provider_user_id` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_providers`
--

INSERT INTO `user_providers` (`provider_id`, `user_id`, `provider_name`, `provider_user_id`, `created_at`) VALUES
(1, 1, 'google', '123456789', '2026-09-15 04:16:14');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `assets`
--
ALTER TABLE `assets`
  ADD PRIMARY KEY (`asset_id`),
  ADD KEY `idx_story_type` (`story_id`,`asset_type`),
  ADD KEY `idx_chapter` (`chapter_id`),
  ADD KEY `fk_assets_user` (`user_id`);

--
-- Indexes for table `chapters`
--
ALTER TABLE `chapters`
  ADD PRIMARY KEY (`chapter_id`),
  ADD UNIQUE KEY `unique_story_chapter` (`story_id`,`chapter_number`),
  ADD KEY `fk_chapters_user` (`user_id`);

--
-- Indexes for table `dialogues`
--
ALTER TABLE `dialogues`
  ADD PRIMARY KEY (`dialogue_id`),
  ADD KEY `idx_chapter_order` (`chapter_id`,`sort_order`);

--
-- Indexes for table `stories`
--
ALTER TABLE `stories`
  ADD PRIMARY KEY (`story_id`),
  ADD KEY `fk_stories_user` (`user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `unique_email` (`email`),
  ADD UNIQUE KEY `unique_google_id` (`google_id`);

--
-- Indexes for table `user_providers`
--
ALTER TABLE `user_providers`
  ADD PRIMARY KEY (`provider_id`),
  ADD UNIQUE KEY `unique_provider` (`provider_name`,`provider_user_id`),
  ADD KEY `user_id` (`user_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `assets`
--
ALTER TABLE `assets`
  MODIFY `asset_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `chapters`
--
ALTER TABLE `chapters`
  MODIFY `chapter_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `dialogues`
--
ALTER TABLE `dialogues`
  MODIFY `dialogue_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `stories`
--
ALTER TABLE `stories`
  MODIFY `story_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `user_providers`
--
ALTER TABLE `user_providers`
  MODIFY `provider_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `assets`
--
ALTER TABLE `assets`
  ADD CONSTRAINT `fk_assets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `chapters`
--
ALTER TABLE `chapters`
  ADD CONSTRAINT `chapters_ibfk_1` FOREIGN KEY (`story_id`) REFERENCES `stories` (`story_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_chapters_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `dialogues`
--
ALTER TABLE `dialogues`
  ADD CONSTRAINT `dialogues_ibfk_1` FOREIGN KEY (`chapter_id`) REFERENCES `chapters` (`chapter_id`) ON DELETE CASCADE;

--
-- Constraints for table `stories`
--
ALTER TABLE `stories`
  ADD CONSTRAINT `fk_stories_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `user_providers`
--
ALTER TABLE `user_providers`
  ADD CONSTRAINT `user_providers_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
