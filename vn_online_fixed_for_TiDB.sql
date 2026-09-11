-- vn_online_fixed_for_TiDB.sql
-- แก้จาก vn_online (5).sql ให้ตรงกับ src/db.js ของ VisualNovelStudio
-- เปลี่ยน: asset_type enum ตัด 'cover' ออก (โปรเจกต์ไม่มี), คง utf8mb4, InnoDB
-- ใช้ import บน TiDB Cloud > SQL Editor หรือ mysql -h gateway01.ap-southeast-1.prod.aws.tidbcloud.com -P 4000 -u <user> -p vn_online < thisfile
-- วันที่แก้: 2026-09-11
-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 08, 2026 at 08:31 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

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
  `size_bytes` bigint(20) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `user_id` int(11) DEFAULT NULL,
  `guest_id` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `assets`
--

INSERT INTO `assets` (`asset_id`, `story_id`, `chapter_id`, `asset_type`, `asset_name`, `file_name`, `file_path`, `mime_type`, `size_bytes`, `created_at`, `updated_at`, `user_id`, `guest_id`) VALUES
(8, 13, NULL, 'character', 'Dante_idle', 'Dante_StandingSprite.png', '/assets/characters/Dante/1788608319429-710008812-Dante_StandingSprite.png', 'image/png', 704713, '2026-09-05 11:38:39', '2026-09-05 11:45:06', 5, NULL),
(9, 13, NULL, 'background', 'รถบัส', 'Story_Aboard_Mephistopheles_10_BG.png', '/assets/backgrounds/1788608348444-116541716-Story_Aboard_Mephistopheles_10_BG.png', 'image/png', 1052868, '2026-09-05 11:39:08', '2026-09-05 11:39:08', 5, NULL),
(10, 13, NULL, 'character', 'Don_Quixote_WoW', 'Don_Quixote_Sprite_2.png', '/assets/characters/Don/1788608370061-712584114-Don_Quixote_Sprite_2.png', 'image/png', 607710, '2026-09-05 11:39:30', '2026-09-05 11:39:58', 5, NULL),
(11, 13, NULL, 'character', 'Don_Quixote_ร่าเริง', 'Don_Quixote_Sprite_1.png', '/assets/characters/Don/1788608438899-295789325-Don_Quixote_Sprite_1.png', 'image/png', 607933, '2026-09-05 11:40:38', '2026-09-05 11:41:47', 5, NULL),
(12, 13, NULL, 'character', 'Don Quixote_มองซ้าย', 'Don_Quixote_Sprite_4.png', '/assets/characters/Don/1788608601935-281088701-Don_Quixote_Sprite_4.png', 'image/png', 607235, '2026-09-05 11:43:21', '2026-09-05 15:41:03', 5, NULL),
(13, 13, NULL, 'character', 'Don_Quixote_idle', 'Don_Quixote_StandingSprite.png', '/assets/characters/Don/1788608682514-336070250-Don_Quixote_StandingSprite.png', 'image/png', 525908, '2026-09-05 11:44:42', '2026-09-05 11:44:42', 5, NULL),
(14, 13, NULL, 'bgm', 'Limbus Company - Mephistopheles Story Theme', 'Limbus Company - Mephistopheles Story Theme.mp3', '/assets/bgm/1788615490595-26282785-Limbus_Company_-_Mephistopheles_Story_Theme.mp3', 'audio/mpeg', 1510432, '2026-09-05 13:38:10', '2026-09-05 13:38:10', 5, NULL),
(15, 13, NULL, 'sfx', 'genshin-teleport', 'genshin-teleport.mp3', '/assets/bgm/1788615515600-500840643-genshin-teleport.mp3', 'audio/mpeg', 53171, '2026-09-05 13:38:35', '2026-09-05 13:38:41', 5, NULL),
(16, 13, NULL, 'sfx', 'dante_ติ๊กต๊อกพูดยาว', 'dante_limbus_company.mp3', '/assets/bgm/1788616192328-525355810-dante_limbus_company.mp3', 'audio/mpeg', 54053, '2026-09-05 13:49:52', '2026-09-05 13:49:59', 5, NULL),
(18, 13, NULL, 'sfx', 'dante\'s-gong-', 'dante\'s-gong-sound-made-with-Voicemod.mp3', '/assets/bgm/1788616395241-465332327-dante_s-gong-sound-made-with-Voicemod.mp3', 'audio/mpeg', 59904, '2026-09-05 13:53:15', '2026-09-05 13:53:20', 5, NULL),
(19, 13, NULL, 'sfx', 'dante-clock-surprise-sound-made-with-Voicemod', 'dante-clock-surprise-sound-made-with-Voicemod.mp3', '/assets/sfx/1788616418344-949460616-dante-clock-surprise-sound-made-with-Voicemod.mp3', 'audio/mpeg', 23040, '2026-09-05 13:53:38', '2026-09-05 13:53:38', 5, NULL),
(20, 13, NULL, 'sfx', 'dante-hurt-sound-clock-made-with-Voicemod', 'dante-hurt-sound-clock-made-with-Voicemod.mp3', '/assets/bgm/1788616500558-238305005-dante-hurt-sound-clock-made-with-Voicemod.mp3', 'audio/mpeg', 35328, '2026-09-05 13:55:00', '2026-09-05 13:55:08', 5, NULL),
(21, 13, NULL, 'sfx', 'clashSWORD', 'limbus_company_clash.mp3', '/assets/sfx/1788616537507-139041265-limbus_company_clash.mp3', 'audio/mpeg', 59073, '2026-09-05 13:55:37', '2026-09-05 13:55:37', 5, NULL),
(22, 13, NULL, 'sfx', 'dante-wick-clock-made-with-Voicemod', 'dante-wick-clock-made-with-Voicemod.mp3', '/assets/sfx/1788616559164-443769983-dante-wick-clock-made-with-Voicemod.mp3', 'audio/mpeg', 61056, '2026-09-05 13:55:59', '2026-09-05 13:55:59', 5, NULL),
(23, 13, NULL, 'sfx', 'dante-train-ตกใจมาก', 'dante-train-made-with-Voicemod.mp3', '/assets/sfx/1788616636664-145096649-dante-train-made-with-Voicemod.mp3', 'audio/mpeg', 25005, '2026-09-05 13:57:16', '2026-09-05 13:57:16', 5, NULL),
(24, 13, NULL, 'sfx', 'dante-register-made-with-Voicemod', 'dante-register-made-with-Voicemod.mp3', '/assets/sfx/1788616722191-24370411-dante-register-made-with-Voicemod.mp3', 'audio/mpeg', 23853, '2026-09-05 13:58:42', '2026-09-05 13:58:42', 5, NULL),
(25, 13, NULL, 'sfx', 'stagger-made-with-Voicemod', 'stagger-made-with-Voicemod.mp3', '/assets/sfx/1788621266341-668726479-stagger-made-with-Voicemod.mp3', 'audio/mpeg', 23085, '2026-09-05 15:14:26', '2026-09-05 15:14:26', 5, NULL),
(26, 13, NULL, 'sfx', 'manager-esquiree!!!!!!-made-with-Voicemod', 'manager-esquiree!!!!!!-made-with-Voicemod.mp3', '/assets/sfx/1788621386653-332486473-manager-esquiree______-made-with-Voicemod.mp3', 'audio/mpeg', 93741, '2026-09-05 15:16:26', '2026-09-05 15:16:26', 5, NULL),
(27, 13, NULL, 'character', 'Vergilius_StandingSprite', 'Vergilius_StandingSprite.png', '/assets/characters/Vergilius/1788622524547-429038743-Vergilius_StandingSprite.png', 'image/png', 440593, '2026-09-05 15:35:24', '2026-09-05 15:35:24', 5, NULL),
(28, 13, NULL, 'character', 'Vergilius_Sprite_8เหนื่อยหน่าย', 'Vergilius_Sprite_8.png', '/assets/characters/Vergilius/1788622573356-391695064-Vergilius_Sprite_8.png', 'image/png', 440485, '2026-09-05 15:36:13', '2026-09-05 15:36:13', 5, NULL),
(29, 13, NULL, 'character', 'Vergilius_idle', 'Vergilius_StandingSprite.png', '/assets/characters/Vergilius/1788622599732-989181642-Vergilius_StandingSprite.png', 'image/png', 440593, '2026-09-05 15:36:39', '2026-09-05 15:36:39', 5, NULL),
(30, 13, NULL, 'character', 'Heathcliff_Remember_Sprite_5', 'Heathcliff_Remember_Sprite_5.png', '/assets/characters/Heathcliff/1788622608397-410671137-Heathcliff_Remember_Sprite_5.png', 'image/png', 546726, '2026-09-05 15:36:48', '2026-09-05 15:36:48', 5, NULL),
(31, 13, NULL, 'character', 'Don_Quixote_แก้มป่อง', 'Don_Quixote_Sprite_12.png', '/assets/characters/Don/1788622671962-380435346-Don_Quixote_Sprite_12.png', 'image/png', 607682, '2026-09-05 15:37:51', '2026-09-05 15:37:51', 5, NULL),
(32, 13, NULL, 'character', 'Hong_Lu_Sprite_ยิ้ม', 'Hong_Lu_Sprite_5.png', '/assets/characters/Hong/1788622752208-353643461-Hong_Lu_Sprite_5.png', 'image/png', 812780, '2026-09-05 15:39:12', '2026-09-05 15:39:12', 5, NULL),
(34, 13, NULL, 'character', 'Hong_Lu_Sprite_ซีเรียส', 'Hong_Lu_Sprite_23.png', '/assets/characters/Hong/1788622814168-625113137-Hong_Lu_Sprite_23.png', 'image/png', 829398, '2026-09-05 15:40:14', '2026-09-05 15:40:14', 5, NULL),
(35, 13, NULL, 'character', 'Hong_Lu_idle', 'Hong_Lu_StandingSprite.png', '/assets/characters/Hong/1788622849383-31581483-Hong_Lu_StandingSprite.png', 'image/png', 721679, '2026-09-05 15:40:49', '2026-09-05 15:40:49', 5, NULL),
(36, 13, NULL, 'character', 'Ryōshū_Scabbard_idle', 'RyÅshÅ«_Scabbard_StandingSprite.png', '/assets/characters/Ryōshū/1788622935106-547590947-Ry__sh___Scabbard_StandingSprite.png', 'image/png', 526472, '2026-09-05 15:42:15', '2026-09-05 15:42:15', 5, NULL),
(37, 13, NULL, 'character', 'Ryōshū_Scabbard_ชั่วร้ายโกรธ', 'RyÅshÅ«_Scabbard_Sprite_11.png', '/assets/characters/Ryōshū/1788622976866-129958784-Ry__sh___Scabbard_Sprite_11.png', 'image/png', 525630, '2026-09-05 15:42:56', '2026-09-05 15:42:56', 5, NULL),
(38, 13, NULL, 'background', 'Story_Aboard_Mephistopheles_ตอนเย็น', 'Story_Aboard_Mephistopheles_6_BG.png', '/assets/characters/Story/1788624894853-399493537-Story_Aboard_Mephistopheles_6_BG.png', 'image/png', 1607891, '2026-09-05 16:14:54', '2026-09-05 16:15:04', 5, NULL),
(39, 13, NULL, 'bgm', 'Limbus Company OST - Happy', 'Limbus Company OST - Happy.mp3', '/assets/bgm/1788625501818-494768587-Limbus_Company_OST_-_Happy.mp3', 'audio/mpeg', 1444186, '2026-09-05 16:25:01', '2026-09-05 16:25:01', 5, NULL),
(40, 13, NULL, 'character', 'Yuuka_00', 'Yuuka_00.png', '/assets/characters/Yuuka/1788626063553-147578115-Yuuka_00.png', 'image/png', 466845, '2026-09-05 16:34:23', '2026-09-05 16:34:23', 5, NULL),
(41, 13, NULL, 'sfx', 'blue-archive-respond-chat', 'blue-archive-respond-chat.mp3', '/assets/sfx/1788626198622-291334280-blue-archive-respond-chat.mp3', 'audio/mpeg', 19249, '2026-09-05 16:36:38', '2026-09-05 16:36:38', 5, NULL),
(42, 13, NULL, 'character', 'Amiya', 'Limbus-Amiya.webp', '/assets/characters/Amiya/1788627823303-679329086-Limbus-Amiya.webp', 'image/webp', 157562, '2026-09-05 17:03:43', '2026-09-05 17:03:43', 5, NULL),
(43, 13, NULL, 'character', 'Paimon', 'image-removebg-preview.png', '/assets/characters/Paimon/1788628262978-373196682-image-removebg-preview.png', 'image/png', 208668, '2026-09-05 17:11:02', '2026-09-05 17:11:02', 5, NULL),
(44, 13, NULL, 'sfx', 'paimon-laughter', 'paimon-laughter.mp3', '/assets/bgm/1788629103720-315205769-paimon-laughter.mp3', 'audio/mpeg', 44241, '2026-09-05 17:25:03', '2026-09-05 17:25:13', 5, NULL),
(45, 13, NULL, 'background', 'Canard_intro', 'Canard_intro.webp', '/assets/backgrounds/1788754126985-761277615-Canard_intro.webp', 'image/webp', 359724, '2026-09-07 04:08:46', '2026-09-07 04:08:46', 5, NULL),
(47, 14, NULL, 'bgm', '[ LibraryOfRuina Bgm ] Theme 01', '[ LibraryOfRuina Bgm ] Theme 01.mp3', '/assets/bgm/1788759479386-407443616-__LibraryOfRuina_Bgm___Theme_01.mp3', 'audio/mpeg', 770017, '2026-09-07 05:37:59', '2026-09-07 05:37:59', 5, NULL),
(48, 14, NULL, 'sfx', 'PageFlip', 'PageFlip.mp3', '/assets/sfx/1788760597092-428370789-PageFlip.mp3', 'audio/mpeg', 13303, '2026-09-07 05:56:37', '2026-09-07 05:56:37', 5, NULL),
(49, 14, NULL, 'background', 'main', '10570640.jpg', '/assets/backgrounds/1788761444915-686187516-10570640.jpg', 'image/jpeg', 290516, '2026-09-07 06:10:44', '2026-09-07 06:10:44', 5, NULL),
(50, 14, NULL, 'background', 'Screenshot 2026-09-07 131500', 'Screenshot 2026-09-07 131500.png', '/assets/backgrounds/1788761775464-378123656-Screenshot_2026-09-07_131500.png', 'image/png', 1084544, '2026-09-07 06:16:15', '2026-09-07 06:16:15', 5, NULL),
(51, 14, NULL, 'background', 'ex', 'how-to-draw-a-pistol-holding-hand-epic-multi-angle-tutorial-v0-7pljydafzpxe1.webp', '/assets/characters/ex/1788765167249-156065814-how-to-draw-a-pistol-holding-hand-epic-multi-angle-tutorial-v0-7pljydafzpxe1.webp', 'image/webp', 71586, '2026-09-07 07:12:47', '2026-09-07 07:15:30', 5, NULL),
(52, 13, NULL, 'character', 'Amiya_Sprite_2', 'Amiya_Sprite_2.png', '/assets/characters/Amiya/1788765944569-272955860-Amiya_Sprite_2.png', 'image/png', 502614, '2026-09-07 07:25:44', '2026-09-07 07:25:44', 5, NULL),
(53, 13, NULL, 'character', 'Amiya_Sprite_ยิ้ม', 'Amiya_Sprite_8.png', '/assets/characters/Amiya/1788765958407-885380244-Amiya_Sprite_8.png', 'image/png', 502015, '2026-09-07 07:25:58', '2026-09-07 07:25:58', 5, NULL),
(54, 14, NULL, 'character', 'Amiya_Sprite_less', 'Amiya_Sprite_7.png', '/assets/characters/Amiya/1788766009176-310629331-Amiya_Sprite_7.png', 'image/png', 502021, '2026-09-07 07:26:49', '2026-09-07 07:26:49', 5, NULL),
(55, 14, NULL, 'background', 'Screenshot 2026-09-07 150612', 'Screenshot 2026-09-07 150612.png', '/assets/characters/Screenshot_2026-09-07_150612/1788768454214-427774310-Screenshot_2026-09-07_150612.png', 'image/png', 301023, '2026-09-07 08:07:34', '2026-09-07 08:07:42', 5, NULL);

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
(17, 13, 1, 'ภายในรถเมล์ Mephistopheles', NULL, '2026-09-05 10:21:20', '2026-09-05 15:51:02', 5, NULL, 1),
(18, 13, 2, 'ภายในรถเมล์ Mephistopheles ', NULL, '2026-09-05 15:50:49', '2026-09-05 15:50:49', 5, NULL, 1),
(20, 13, 3, 'ภายในรถเมล์ Mephistopheles ', NULL, '2026-09-05 17:52:07', '2026-09-06 13:14:41', 5, NULL, 1),
(22, 14, 1, 'test', NULL, '2026-09-07 05:39:28', '2026-09-07 07:45:43', 5, NULL, 1);

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
(13, 'มากาพคุณต้กับกระต่ายที่', 'http://localhost:3000/assets/covers/1788603673069-960004343-Story_Aboard_Mephistopheles_s_Deck_1_BG.png', NULL, '2026-09-05 10:21:13', '2026-09-05 15:50:34', 5, NULL, 1),
(14, 'f', NULL, NULL, '2026-09-07 04:09:01', '2026-09-07 07:45:46', 5, NULL, 1);

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
(1, 'mock@gmail.com', NULL, '123456789', 'Mock User', NULL, '2026-09-05 09:48:49', '2026-09-05 09:48:49'),
(5, 'exza1529@gmail.com', '$2b$10$QP3FinTNGT3MYqk11fYoQ.rh/61m7N9NsxIzGNkghPiQjbB.v/A..', NULL, 'EX1529', NULL, '2026-09-05 10:18:51', '2026-09-05 10:18:51');

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
(5, 1, 'google', '123456789', '2026-09-05 09:48:49');

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
  MODIFY `asset_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=56;

--
-- AUTO_INCREMENT for table `chapters`
--
ALTER TABLE `chapters`
  MODIFY `chapter_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `stories`
--
ALTER TABLE `stories`
  MODIFY `story_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `user_providers`
--
ALTER TABLE `user_providers`
  MODIFY `provider_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `assets`
--
ALTER TABLE `assets`
  ADD CONSTRAINT `fk_assets_chapter` FOREIGN KEY (`chapter_id`) REFERENCES `chapters` (`chapter_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_assets_story` FOREIGN KEY (`story_id`) REFERENCES `stories` (`story_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_assets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `chapters`
--
ALTER TABLE `chapters`
  ADD CONSTRAINT `chapters_ibfk_1` FOREIGN KEY (`story_id`) REFERENCES `stories` (`story_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_chapters_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

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

