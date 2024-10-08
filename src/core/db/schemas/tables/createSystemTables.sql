
 CREATE TABLE IF NOT EXISTS system (
        systemKey TEXT PRIMARY KEY,
        systemValue TEXT NOT NULL
    );

INSERT INTO system (systemKey, systemValue)
SELECT 'SHUFFLED', 'UNSHUFFLED'
WHERE NOT EXISTS (SELECT 1 FROM system WHERE systemKey = 'SHUFFLED');

INSERT INTO system (systemKey, systemValue)
SELECT 'REPEAT', 'OFF_REPEAT'
WHERE NOT EXISTS (SELECT 1 FROM system WHERE systemKey = 'REPEAT');