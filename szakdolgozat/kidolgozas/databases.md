# Adatbazis strukturak es kapcsolatok

Ez a dokumentum a projektben hasznalt fo alkalmazasi tablakat mutatja be SQL formajaban, rovid magyarazatokkal.
A szerkezet a migraciok es a jelenlegi UML diagramok (`uml_words.md`, `uml_not_words.md`) alapjan keszult.

## 1. Kapcsolati attekintes

- `users` az alap entitas, ehhez kapcsolodik a legtobb tabla.
- Szomodul: `lists_word` -> `words`, `word_gen_messages`, `word_relations`.
- Mentes modul: `board_save_groups` -> `board_saves`, illetve `task_save_groups` -> `task_saves`.
- Szin modul: `color_lists` -> `colors`.
- Naplozas: `access_logs` opcionisan kapcsolodik `users` tablaho.

---

## 2. SQL tablaleirasok

### 2.1 `users`

Felhasznaloi fiokok, szerepkor es aktiv allapot tarolasa.

```sql
CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `role` VARCHAR(255) NOT NULL DEFAULT 'vendeg',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `suspended_at` TIMESTAMP NULL DEFAULT NULL,
  `email_verified_at` TIMESTAMP NULL DEFAULT NULL,
  `password` VARCHAR(255) NOT NULL,
  `remember_token` VARCHAR(100) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_username_unique` (`username`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.2 `lists_word`

Felhasznalonkent letrehozott szolista fejlec.

```sql
CREATE TABLE `lists_word` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `public` TINYINT(1) NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `wordlist` MEDIUMTEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `lists_word_user_id_foreign` (`user_id`),
  CONSTRAINT `lists_word_user_id_foreign`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.3 `words`

A szolistak szavai, generacios bontassal.

```sql
CREATE TABLE `words` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `list_id` BIGINT UNSIGNED NOT NULL,
  `generation` INT UNSIGNED NOT NULL DEFAULT 1,
  `word` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `words_list_generation_word_unique` (`list_id`, `generation`, `word`),
  KEY `fk_words_list` (`list_id`),
  CONSTRAINT `fk_words_list`
    FOREIGN KEY (`list_id`) REFERENCES `lists_word` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.4 `word_gen_messages`

Generacionkent egyedi helyes/helytelen uzenetek listankent.

```sql
CREATE TABLE `word_gen_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `list_id` BIGINT UNSIGNED NOT NULL,
  `generation` INT UNSIGNED NOT NULL,
  `correct_answer_message` TEXT NULL,
  `incorrect_answer_message` TEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `word_gen_messages_list_generation_unique` (`list_id`, `generation`),
  KEY `word_gen_messages_list_id_foreign` (`list_id`),
  CONSTRAINT `word_gen_messages_list_id_foreign`
    FOREIGN KEY (`list_id`) REFERENCES `lists_word` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.5 `word_relations`

Irányitott szokapcsolatok (`from_word_id` -> `to_word_id`) egy listan belul.

```sql
CREATE TABLE `word_relations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `list_id` BIGINT UNSIGNED NOT NULL,
  `from_word_id` BIGINT UNSIGNED NOT NULL,
  `to_word_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `word_relations_unique` (`list_id`, `from_word_id`, `to_word_id`),
  KEY `word_relations_list_id_from_word_id_index` (`list_id`, `from_word_id`),
  KEY `word_relations_list_id_to_word_id_index` (`list_id`, `to_word_id`),
  CONSTRAINT `word_relations_list_id_foreign`
    FOREIGN KEY (`list_id`) REFERENCES `lists_word` (`id`) ON DELETE CASCADE,
  CONSTRAINT `word_relations_from_word_id_foreign`
    FOREIGN KEY (`from_word_id`) REFERENCES `words` (`id`) ON DELETE CASCADE,
  CONSTRAINT `word_relations_to_word_id_foreign`
    FOREIGN KEY (`to_word_id`) REFERENCES `words` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.6 `access_logs`

Felhasznaloi esemenyek naplozasa (latogatas, belepes, kilepes).

```sql
CREATE TABLE `access_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NULL,
  `event_type` VARCHAR(20) NOT NULL,
  `entry_point` VARCHAR(20) NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `user_agent` VARCHAR(1024) NULL,
  `occurred_at` TIMESTAMP NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `access_logs_event_type_entry_point_index` (`event_type`, `entry_point`),
  KEY `access_logs_occurred_at_index` (`occurred_at`),
  KEY `access_logs_user_id_index` (`user_id`),
  CONSTRAINT `access_logs_user_id_foreign`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.7 `color_lists`

Felhasznalonkenti szinpaletta-listak.

```sql
CREATE TABLE `color_lists` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `color_lists_user_id_foreign` (`user_id`),
  CONSTRAINT `color_lists_user_id_foreign`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.8 `colors`

Egy adott szinlista elemei, pozicios egyediseggel.

```sql
CREATE TABLE `colors` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `list_id` BIGINT UNSIGNED NOT NULL,
  `color` VARCHAR(50) NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `colors_list_position_unique` (`list_id`, `position`),
  KEY `colors_list_id_foreign` (`list_id`),
  CONSTRAINT `colors_list_id_foreign`
    FOREIGN KEY (`list_id`) REFERENCES `color_lists` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.9 `board_save_groups`

Tablamentesek csoportositasa felhasznalonkent.

```sql
CREATE TABLE `board_save_groups` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `position` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `board_save_groups_user_id_foreign` (`user_id`),
  CONSTRAINT `board_save_groups_user_id_foreign`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.10 `board_saves`

Konkret tablaallapot-mentesek JSON payload formaban.

```sql
CREATE TABLE `board_saves` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `board_save_group_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `payload` JSON NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `board_saves_board_save_group_id_name_unique` (`board_save_group_id`, `name`),
  KEY `board_saves_user_id_foreign` (`user_id`),
  CONSTRAINT `board_saves_user_id_foreign`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `board_saves_board_save_group_id_foreign`
    FOREIGN KEY (`board_save_group_id`) REFERENCES `board_save_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.11 `task_save_groups`

Feladatmentesek csoportositasa felhasznalonkent.

```sql
CREATE TABLE `task_save_groups` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `position` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `task_save_groups_user_id_foreign` (`user_id`),
  CONSTRAINT `task_save_groups_user_id_foreign`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2.12 `task_saves`

Feladatbeallitasok es allapotmentesek tarolasa.

```sql
CREATE TABLE `task_saves` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `task_save_group_id` BIGINT UNSIGNED NOT NULL,
  `word_list_id` BIGINT UNSIGNED NULL,
  `name` VARCHAR(255) NOT NULL,
  `level` ENUM('Easy','Medium','Hard') NOT NULL DEFAULT 'Medium',
  `generation_mode` VARCHAR(50) NOT NULL,
  `board_size` INT UNSIGNED NOT NULL,
  `generations_count` INT UNSIGNED NOT NULL,
  `time_limit` INT UNSIGNED NOT NULL,
  `payload` JSON NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `task_saves_group_name_unique` (`task_save_group_id`, `name`),
  KEY `task_saves_user_id_foreign` (`user_id`),
  KEY `task_saves_word_list_id_foreign` (`word_list_id`),
  CONSTRAINT `task_saves_user_id_foreign`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `task_saves_task_save_group_id_foreign`
    FOREIGN KEY (`task_save_group_id`) REFERENCES `task_save_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `task_saves_word_list_id_foreign`
    FOREIGN KEY (`word_list_id`) REFERENCES `lists_word` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 3. Osszefoglalo magyarazat

- Az adatmodell tudatosan `users`-kozpontu: szinte minden adat tulajdonosa egy felhasznalo.
- A szomodul (`lists_word`, `words`, `word_gen_messages`, `word_relations`) normalizalt, eros referencialis integritassal.
- A mentesi modul (`board_*`, `task_*`) csoportositasra epul, ami attekinthetobbe teszi a felhasznaloi menteseket.
- A JSON `payload` mezok rugalmasak: lehetove teszik a kliensallapot tarolasat schema-modositas nelkul.
- Az `access_logs` kulon naplo tablakent audit celokat szolgal, es anonim esemenyeket is kepes kezelni (`user_id` nullable).
