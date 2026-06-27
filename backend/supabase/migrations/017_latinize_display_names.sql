-- ============================================================================
-- InfluenceHub — 017_latinize_display_names.sql
-- Fixes league QA #10: several seeded profiles carried Cyrillic display names
-- (real RU/CA public figures + two mixed-script typos), which read inconsistently
-- in the Latin UI next to their now-English bios (see 015).
--
-- These are well-known people with established Latin spellings, so a curated
-- name->name mapping is used rather than a character-by-character transliteration
-- (which mangles conventional spellings of ц/я/й/щ etc.). Matching on the current
-- display_name makes this idempotent: after one run none of the source strings
-- remain, so a second run is a no-op. Also cleans two mixed-script names where a
-- single Cyrillic letter slipped into an otherwise-Latin handle.
-- ============================================================================

update public.influencer_profiles ip
   set display_name = m.dst
  from (values
    ('Гусейн Гасанов',       'Gusein Gasanov'),
    ('Настя Ивлеева',        'Nastya Ivleeva'),
    ('Регина Тодоренко',     'Regina Todorenko'),
    ('Яна Рудковская',       'Yana Rudkovskaya'),
    ('Мадлен (Мадина)',      'Madlen (Madina)'),
    ('Умида Одилова',        'Umida Odilova'),
    ('Жанат Калтаева',       'Zhanat Kaltaeva'),
    ('Камила Гимандинова',   'Kamila Gimandinova'),
    ('Рустам Назаров',       'Rustam Nazarov'),
    ('Гулноза Сафарова',     'Gulnoza Safarova'),
    ('Непарвина',            'Neparvina'),
    ('Abrorbek Axmedbеkov',  'Abrorbek Axmedbekov'),  -- stray Cyrillic 'е'
    ('Тима Назаров',         'Tima Nazarov'),
    ('Лера Кудрявцева',      'Lera Kudryavtseva'),
    ('Тимур Батрутдинов',    'Timur Batrutdinov'),
    ('Жenis Omarov',         'Zhenis Omarov'),         -- stray Cyrillic 'Ж'
    ('Нигина Амонкулова',    'Nigina Amonkulova'),
    ('Ида Галич',            'Ida Galich'),
    ('Фируза Хафизова',      'Firuza Khafizova'),
    ('Манижа Давлатова',     'Manizha Davlatova'),
    ('Азода Юсупахмет',      'Azoda Yusupakhmet')
  ) as m(src, dst)
 where ip.display_name = m.src;
