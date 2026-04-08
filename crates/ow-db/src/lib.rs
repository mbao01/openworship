// SQLite persistence layer — Bible translations and verse data.
// Seeded in-memory at startup from public-domain scripture text.

use anyhow::Result;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────
// Public types
// ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Translation {
    pub id: String,
    pub name: String,
    pub abbreviation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Verse {
    pub translation: String,
    pub book: String,
    pub book_number: u32,
    pub chapter: u32,
    pub verse: u32,
    pub text: String,
    pub reference: String,
}

// ─────────────────────────────────────────
// Schema
// ─────────────────────────────────────────

fn create_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS translations (
            id           TEXT PRIMARY KEY,
            name         TEXT NOT NULL,
            abbreviation TEXT NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS verses (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            translation_id TEXT NOT NULL REFERENCES translations(id),
            book           TEXT NOT NULL,
            book_number    INTEGER NOT NULL,
            chapter        INTEGER NOT NULL,
            verse          INTEGER NOT NULL,
            text           TEXT NOT NULL,
            UNIQUE(translation_id, book_number, chapter, verse)
        );
        CREATE INDEX IF NOT EXISTS idx_verses_ref
            ON verses(translation_id, book_number, chapter, verse);",
    )?;
    Ok(())
}

// ─────────────────────────────────────────
// Seed data (public-domain translations)
// KJV — King James Version (public domain)
// WEB — World English Bible (public domain)
// BSB — Berean Standard Bible (CC BY 4.0)
// ─────────────────────────────────────────

struct SeedVerse {
    translation: &'static str,
    book: &'static str,
    book_number: u32,
    chapter: u32,
    verse: u32,
    text: &'static str,
}

const SEED_VERSES: &[SeedVerse] = &[
    // ─── Genesis 1 (KJV) ───
    SeedVerse { translation: "KJV", book: "Genesis", book_number: 1, chapter: 1, verse: 1,
        text: "In the beginning God created the heaven and the earth." },
    SeedVerse { translation: "KJV", book: "Genesis", book_number: 1, chapter: 1, verse: 2,
        text: "And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters." },
    SeedVerse { translation: "KJV", book: "Genesis", book_number: 1, chapter: 1, verse: 3,
        text: "And God said, Let there be light: and there was light." },
    // ─── Psalms 23 (KJV) ───
    SeedVerse { translation: "KJV", book: "Psalms", book_number: 19, chapter: 23, verse: 1,
        text: "The LORD is my shepherd; I shall not want." },
    SeedVerse { translation: "KJV", book: "Psalms", book_number: 19, chapter: 23, verse: 2,
        text: "He maketh me to lie down in green pastures: he leadeth me beside the still waters." },
    SeedVerse { translation: "KJV", book: "Psalms", book_number: 19, chapter: 23, verse: 3,
        text: "He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake." },
    SeedVerse { translation: "KJV", book: "Psalms", book_number: 19, chapter: 23, verse: 4,
        text: "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me." },
    SeedVerse { translation: "KJV", book: "Psalms", book_number: 19, chapter: 23, verse: 5,
        text: "Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over." },
    SeedVerse { translation: "KJV", book: "Psalms", book_number: 19, chapter: 23, verse: 6,
        text: "Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever." },
    // ─── Isaiah 40 (KJV) ───
    SeedVerse { translation: "KJV", book: "Isaiah", book_number: 23, chapter: 40, verse: 28,
        text: "Hast thou not known? hast thou not heard, that the everlasting God, the LORD, the Creator of the ends of the earth, fainteth not, neither is weary? there is no searching of his understanding." },
    SeedVerse { translation: "KJV", book: "Isaiah", book_number: 23, chapter: 40, verse: 29,
        text: "He giveth power to the faint; and to them that have no might he increaseth strength." },
    SeedVerse { translation: "KJV", book: "Isaiah", book_number: 23, chapter: 40, verse: 31,
        text: "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint." },
    // ─── Matthew 5 (KJV) ───
    SeedVerse { translation: "KJV", book: "Matthew", book_number: 40, chapter: 5, verse: 3,
        text: "Blessed are the poor in spirit: for theirs is the kingdom of heaven." },
    SeedVerse { translation: "KJV", book: "Matthew", book_number: 40, chapter: 5, verse: 4,
        text: "Blessed are they that mourn: for they shall be comforted." },
    SeedVerse { translation: "KJV", book: "Matthew", book_number: 40, chapter: 5, verse: 5,
        text: "Blessed are the meek: for they shall inherit the earth." },
    SeedVerse { translation: "KJV", book: "Matthew", book_number: 40, chapter: 5, verse: 6,
        text: "Blessed are they which do hunger and thirst after righteousness: for they shall be filled." },
    SeedVerse { translation: "KJV", book: "Matthew", book_number: 40, chapter: 5, verse: 7,
        text: "Blessed are the merciful: for they shall obtain mercy." },
    SeedVerse { translation: "KJV", book: "Matthew", book_number: 40, chapter: 5, verse: 8,
        text: "Blessed are the pure in heart: for they shall see God." },
    SeedVerse { translation: "KJV", book: "Matthew", book_number: 40, chapter: 5, verse: 9,
        text: "Blessed are the peacemakers: for they shall be called the children of God." },
    // ─── John 1 (KJV) ───
    SeedVerse { translation: "KJV", book: "John", book_number: 43, chapter: 1, verse: 1,
        text: "In the beginning was the Word, and the Word was with God, and the Word was God." },
    SeedVerse { translation: "KJV", book: "John", book_number: 43, chapter: 1, verse: 2,
        text: "The same was in the beginning with God." },
    SeedVerse { translation: "KJV", book: "John", book_number: 43, chapter: 1, verse: 3,
        text: "All things were made by him; and without him was not any thing made that was made." },
    SeedVerse { translation: "KJV", book: "John", book_number: 43, chapter: 1, verse: 4,
        text: "In him was life; and the life was the light of men." },
    SeedVerse { translation: "KJV", book: "John", book_number: 43, chapter: 1, verse: 5,
        text: "And the light shineth in darkness; and the darkness comprehended it not." },
    SeedVerse { translation: "KJV", book: "John", book_number: 43, chapter: 1, verse: 14,
        text: "And the Word was made flesh, and dwelt among us, (and we beheld his glory, the glory as of the only begotten of the Father,) full of grace and truth." },
    // ─── John 3 (KJV) ───
    SeedVerse { translation: "KJV", book: "John", book_number: 43, chapter: 3, verse: 16,
        text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life." },
    SeedVerse { translation: "KJV", book: "John", book_number: 43, chapter: 3, verse: 17,
        text: "For God sent not his Son into the world to condemn the world; but that the world through him might be saved." },
    // ─── John 11 (KJV) ───
    SeedVerse { translation: "KJV", book: "John", book_number: 43, chapter: 11, verse: 25,
        text: "Jesus said unto her, I am the resurrection, and the life: he that believeth in me, though he were dead, yet shall he live:" },
    SeedVerse { translation: "KJV", book: "John", book_number: 43, chapter: 11, verse: 26,
        text: "And whosoever liveth and believeth in me shall never die. Believest thou this?" },
    // ─── John 14 (KJV) ───
    SeedVerse { translation: "KJV", book: "John", book_number: 43, chapter: 14, verse: 6,
        text: "Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me." },
    // ─── Romans 8 (KJV) ───
    SeedVerse { translation: "KJV", book: "Romans", book_number: 45, chapter: 8, verse: 28,
        text: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose." },
    SeedVerse { translation: "KJV", book: "Romans", book_number: 45, chapter: 8, verse: 38,
        text: "For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come," },
    SeedVerse { translation: "KJV", book: "Romans", book_number: 45, chapter: 8, verse: 39,
        text: "Nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord." },
    // ─── 1 Corinthians 13 (KJV) ───
    SeedVerse { translation: "KJV", book: "1 Corinthians", book_number: 46, chapter: 13, verse: 1,
        text: "Though I speak with the tongues of men and of angels, and have not charity, I am become as sounding brass, or a tinkling cymbal." },
    SeedVerse { translation: "KJV", book: "1 Corinthians", book_number: 46, chapter: 13, verse: 4,
        text: "Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up," },
    SeedVerse { translation: "KJV", book: "1 Corinthians", book_number: 46, chapter: 13, verse: 13,
        text: "And now abideth faith, hope, charity, these three; but the greatest of these is charity." },
    // ─── Philippians 4 (KJV) ───
    SeedVerse { translation: "KJV", book: "Philippians", book_number: 50, chapter: 4, verse: 6,
        text: "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God." },
    SeedVerse { translation: "KJV", book: "Philippians", book_number: 50, chapter: 4, verse: 7,
        text: "And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus." },
    SeedVerse { translation: "KJV", book: "Philippians", book_number: 50, chapter: 4, verse: 13,
        text: "I can do all things through Christ which strengtheneth me." },

    // ─── Genesis 1 (WEB) ───
    SeedVerse { translation: "WEB", book: "Genesis", book_number: 1, chapter: 1, verse: 1,
        text: "In the beginning, God created the heavens and the earth." },
    SeedVerse { translation: "WEB", book: "Genesis", book_number: 1, chapter: 1, verse: 2,
        text: "The earth was formless and empty. Darkness was on the surface of the deep and God's Spirit was hovering over the surface of the waters." },
    SeedVerse { translation: "WEB", book: "Genesis", book_number: 1, chapter: 1, verse: 3,
        text: "God said, \"Let there be light,\" and there was light." },
    // ─── Psalms 23 (WEB) ───
    SeedVerse { translation: "WEB", book: "Psalms", book_number: 19, chapter: 23, verse: 1,
        text: "Yahweh is my shepherd; I shall lack nothing." },
    SeedVerse { translation: "WEB", book: "Psalms", book_number: 19, chapter: 23, verse: 2,
        text: "He makes me lie down in green pastures. He leads me beside still waters." },
    SeedVerse { translation: "WEB", book: "Psalms", book_number: 19, chapter: 23, verse: 3,
        text: "He restores my soul. He guides me in the paths of righteousness for his name's sake." },
    SeedVerse { translation: "WEB", book: "Psalms", book_number: 19, chapter: 23, verse: 4,
        text: "Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me." },
    SeedVerse { translation: "WEB", book: "Psalms", book_number: 19, chapter: 23, verse: 5,
        text: "You prepare a table before me in the presence of my enemies. You anoint my head with oil. My cup runs over." },
    SeedVerse { translation: "WEB", book: "Psalms", book_number: 19, chapter: 23, verse: 6,
        text: "Surely goodness and loving kindness shall follow me all the days of my life, and I will dwell in Yahweh's house forever." },
    // ─── Isaiah 40 (WEB) ───
    SeedVerse { translation: "WEB", book: "Isaiah", book_number: 23, chapter: 40, verse: 31,
        text: "but those who wait for Yahweh will renew their strength. They will mount up with wings like eagles. They will run, and not be weary. They will walk, and not faint." },
    // ─── John 1 (WEB) ───
    SeedVerse { translation: "WEB", book: "John", book_number: 43, chapter: 1, verse: 1,
        text: "In the beginning was the Word, and the Word was with God, and the Word was God." },
    SeedVerse { translation: "WEB", book: "John", book_number: 43, chapter: 1, verse: 4,
        text: "In him was life, and the life was the light of men." },
    SeedVerse { translation: "WEB", book: "John", book_number: 43, chapter: 1, verse: 14,
        text: "The Word became flesh, and lived among us. We saw his glory, such glory as of the one and only Son of the Father, full of grace and truth." },
    // ─── John 3 (WEB) ───
    SeedVerse { translation: "WEB", book: "John", book_number: 43, chapter: 3, verse: 16,
        text: "For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life." },
    SeedVerse { translation: "WEB", book: "John", book_number: 43, chapter: 3, verse: 17,
        text: "For God didn't send his Son into the world to judge the world, but that the world should be saved through him." },
    // ─── John 14 (WEB) ───
    SeedVerse { translation: "WEB", book: "John", book_number: 43, chapter: 14, verse: 6,
        text: "Jesus said to him, \"I am the way, the truth, and the life. No one comes to the Father, except through me.\"" },
    // ─── Romans 8 (WEB) ───
    SeedVerse { translation: "WEB", book: "Romans", book_number: 45, chapter: 8, verse: 28,
        text: "We know that all things work together for good for those who love God, to those who are called according to his purpose." },
    // ─── Philippians 4 (WEB) ───
    SeedVerse { translation: "WEB", book: "Philippians", book_number: 50, chapter: 4, verse: 6,
        text: "In nothing be anxious, but in everything, by prayer and petition with thanksgiving, let your requests be made known to God." },
    SeedVerse { translation: "WEB", book: "Philippians", book_number: 50, chapter: 4, verse: 7,
        text: "And the peace of God, which surpasses all understanding, will guard your hearts and your thoughts in Christ Jesus." },
    SeedVerse { translation: "WEB", book: "Philippians", book_number: 50, chapter: 4, verse: 13,
        text: "I can do all things through Christ, who strengthens me." },

    // ─── Genesis 1 (BSB) ───
    SeedVerse { translation: "BSB", book: "Genesis", book_number: 1, chapter: 1, verse: 1,
        text: "In the beginning God created the heavens and the earth." },
    SeedVerse { translation: "BSB", book: "Genesis", book_number: 1, chapter: 1, verse: 2,
        text: "Now the earth was formless and void, and darkness was over the surface of the deep. And the Spirit of God was hovering over the surface of the waters." },
    SeedVerse { translation: "BSB", book: "Genesis", book_number: 1, chapter: 1, verse: 3,
        text: "And God said, \"Let there be light,\" and there was light." },
    // ─── Psalms 23 (BSB) ───
    SeedVerse { translation: "BSB", book: "Psalms", book_number: 19, chapter: 23, verse: 1,
        text: "The LORD is my shepherd; I shall not want." },
    SeedVerse { translation: "BSB", book: "Psalms", book_number: 19, chapter: 23, verse: 2,
        text: "He makes me lie down in green pastures; He leads me beside quiet waters." },
    SeedVerse { translation: "BSB", book: "Psalms", book_number: 19, chapter: 23, verse: 3,
        text: "He restores my soul; He guides me in the paths of righteousness for the sake of His name." },
    SeedVerse { translation: "BSB", book: "Psalms", book_number: 19, chapter: 23, verse: 4,
        text: "Even though I walk through the valley of the shadow of death, I will fear no evil, for You are with me; Your rod and Your staff, they comfort me." },
    SeedVerse { translation: "BSB", book: "Psalms", book_number: 19, chapter: 23, verse: 5,
        text: "You prepare a table before me in the presence of my enemies. You anoint my head with oil; my cup overflows." },
    SeedVerse { translation: "BSB", book: "Psalms", book_number: 19, chapter: 23, verse: 6,
        text: "Surely goodness and mercy will follow me all the days of my life, and I will dwell in the house of the LORD forever." },
    // ─── Isaiah 40 (BSB) ───
    SeedVerse { translation: "BSB", book: "Isaiah", book_number: 23, chapter: 40, verse: 31,
        text: "but those who wait upon the LORD will renew their strength; they will mount up with wings like eagles; they will run and not grow weary, they will walk and not faint." },
    // ─── John 1 (BSB) ───
    SeedVerse { translation: "BSB", book: "John", book_number: 43, chapter: 1, verse: 1,
        text: "In the beginning was the Word, and the Word was with God, and the Word was God." },
    SeedVerse { translation: "BSB", book: "John", book_number: 43, chapter: 1, verse: 14,
        text: "The Word became flesh and made His dwelling among us. We have seen His glory, the glory of the one and only Son from the Father, full of grace and truth." },
    // ─── John 3 (BSB) ───
    SeedVerse { translation: "BSB", book: "John", book_number: 43, chapter: 3, verse: 16,
        text: "For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life." },
    SeedVerse { translation: "BSB", book: "John", book_number: 43, chapter: 3, verse: 17,
        text: "For God did not send His Son into the world to condemn the world, but to save the world through Him." },
    // ─── John 14 (BSB) ───
    SeedVerse { translation: "BSB", book: "John", book_number: 43, chapter: 14, verse: 6,
        text: "Jesus answered, \"I am the way and the truth and the life. No one comes to the Father except through Me.\"" },
    // ─── Romans 8 (BSB) ───
    SeedVerse { translation: "BSB", book: "Romans", book_number: 45, chapter: 8, verse: 28,
        text: "And we know that God works all things together for the good of those who love Him, who are called according to His purpose." },
    // ─── Philippians 4 (BSB) ───
    SeedVerse { translation: "BSB", book: "Philippians", book_number: 50, chapter: 4, verse: 6,
        text: "Be anxious for nothing, but in everything, by prayer and petition, with thanksgiving, present your requests to God." },
    SeedVerse { translation: "BSB", book: "Philippians", book_number: 50, chapter: 4, verse: 7,
        text: "And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus." },
    SeedVerse { translation: "BSB", book: "Philippians", book_number: 50, chapter: 4, verse: 13,
        text: "I can do all things through Christ who gives me strength." },
];

fn seed_data(conn: &Connection) -> Result<()> {
    let translations = [
        ("KJV", "King James Version"),
        ("WEB", "World English Bible"),
        ("BSB", "Berean Standard Bible"),
    ];
    for (id, name) in &translations {
        conn.execute(
            "INSERT OR IGNORE INTO translations (id, name, abbreviation) VALUES (?1, ?2, ?1)",
            params![id, name],
        )?;
    }
    for v in SEED_VERSES {
        conn.execute(
            "INSERT OR IGNORE INTO verses
                (translation_id, book, book_number, chapter, verse, text)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![v.translation, v.book, v.book_number, v.chapter, v.verse, v.text],
        )?;
    }
    Ok(())
}

// ─────────────────────────────────────────
// Public API
// ─────────────────────────────────────────

/// Open an in-memory SQLite DB, create schema, and seed scripture data.
pub fn open_and_seed() -> Result<Connection> {
    let conn = Connection::open_in_memory()?;
    create_schema(&conn)?;
    seed_data(&conn)?;
    Ok(conn)
}

pub fn list_translations(conn: &Connection) -> Result<Vec<Translation>> {
    let mut stmt =
        conn.prepare("SELECT id, name, abbreviation FROM translations ORDER BY name")?;
    let rows = stmt.query_map([], |row| {
        Ok(Translation {
            id: row.get(0)?,
            name: row.get(1)?,
            abbreviation: row.get(2)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn get_all_verses(conn: &Connection) -> Result<Vec<Verse>> {
    let mut stmt = conn.prepare(
        "SELECT t.abbreviation, v.book, v.book_number, v.chapter, v.verse, v.text
         FROM verses v JOIN translations t ON v.translation_id = t.id
         ORDER BY t.id, v.book_number, v.chapter, v.verse",
    )?;
    let rows = stmt.query_map([], |row| {
        let translation: String = row.get(0)?;
        let book: String = row.get(1)?;
        let book_number: u32 = row.get(2)?;
        let chapter: u32 = row.get(3)?;
        let verse: u32 = row.get(4)?;
        let text: String = row.get(5)?;
        Ok(Verse {
            reference: format!("{} {}:{}", book, chapter, verse),
            translation,
            book,
            book_number,
            chapter,
            verse,
            text,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

// ─────────────────────────────────────────
// Tests
// ─────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Connection {
        open_and_seed().expect("test db init failed")
    }

    #[test]
    fn test_translations_seeded() {
        let conn = test_db();
        let translations = list_translations(&conn).unwrap();
        assert_eq!(translations.len(), 3);
        let abbrevs: Vec<&str> = translations.iter().map(|t| t.abbreviation.as_str()).collect();
        assert!(abbrevs.contains(&"KJV"));
        assert!(abbrevs.contains(&"WEB"));
        assert!(abbrevs.contains(&"BSB"));
    }

    #[test]
    fn test_verses_seeded() {
        let conn = test_db();
        let verses = get_all_verses(&conn).unwrap();
        assert!(!verses.is_empty());
        let john_316 = verses.iter().find(|v| {
            v.translation == "KJV" && v.book == "John" && v.chapter == 3 && v.verse == 16
        });
        assert!(john_316.is_some());
        assert!(john_316.unwrap().text.contains("God so loved"));
    }

    #[test]
    fn test_verse_reference_format() {
        let conn = test_db();
        let verses = get_all_verses(&conn).unwrap();
        let v = verses
            .iter()
            .find(|v| {
                v.translation == "KJV"
                    && v.book == "Psalms"
                    && v.chapter == 23
                    && v.verse == 1
            })
            .unwrap();
        assert_eq!(v.reference, "Psalms 23:1");
    }

    #[test]
    fn test_seed_is_idempotent() {
        // Calling open_and_seed twice on different connections should produce the same count.
        let conn1 = open_and_seed().unwrap();
        let conn2 = open_and_seed().unwrap();
        let verses1 = get_all_verses(&conn1).unwrap();
        let verses2 = get_all_verses(&conn2).unwrap();
        assert_eq!(verses1.len(), verses2.len());
    }

    #[test]
    fn test_all_three_translations_have_john_316() {
        let conn = test_db();
        let verses = get_all_verses(&conn).unwrap();
        for abbrev in &["KJV", "WEB", "BSB"] {
            let found = verses.iter().any(|v| {
                v.translation.as_str() == *abbrev
                    && v.book == "John"
                    && v.chapter == 3
                    && v.verse == 16
            });
            assert!(found, "Missing John 3:16 for {abbrev}");
        }
    }

    #[test]
    fn test_verse_fields_populated() {
        let conn = test_db();
        let verses = get_all_verses(&conn).unwrap();
        for v in &verses {
            assert!(!v.translation.is_empty());
            assert!(!v.book.is_empty());
            assert!(v.book_number > 0);
            assert!(v.chapter > 0);
            assert!(v.verse > 0);
            assert!(!v.text.is_empty());
            assert!(!v.reference.is_empty());
        }
    }
}
