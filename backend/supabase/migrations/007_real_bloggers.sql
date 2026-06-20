-- ============================================================================
-- InfluenceHub — 007_real_bloggers.sql
-- Replace the demo/fake influencers with the real CIS blogger base
-- (docs/CIS_Influencers_База.xlsx — 88 unique creators).
--
--   1. Removes the 25 seeded fake influencers (influencer*@demo.influencehub.app).
--      Demo admins + brands are kept so existing logins keep working.
--   2. Inserts every real blogger as an UNCLAIMED influencer profile
--      (user_id = null) with their social platform rows, a contact stub,
--      an initial analytics snapshot and a pending scraping_queue entry so the
--      daily refresh (008_daily_refresh.sql) picks them up.
--   3. Recomputes league_rank by total followers.
--
-- Idempotent: re-running deletes the previously inserted real bloggers (matched
-- by the canonical profile_url) before re-inserting.
-- ============================================================================

-- ── 1. remove fake influencers ───────────────────────────────────────────────
delete from auth.users
  where email like 'influencer%@demo.influencehub.app';

-- Also drop any unclaimed demo/discovered influencers left without a real source
-- (none expected, but keeps the league clean).
-- (left intentionally narrow — only the seeded fakes above are removed.)

-- ── 2. stage the real bloggers ───────────────────────────────────────────────
create temporary table if not exists _stg_bloggers (
  username      text,
  display_name  text,
  country       text,
  category      text,
  category_raw  text,
  followers     bigint,
  ig_url text, ig_user text,
  tt_url text, tt_user text,
  yt_url text, yt_user text,
  primary_plat  text
) on commit drop;

insert into _stg_bloggers
  (username, display_name, country, category, category_raw, followers,
   ig_url, ig_user, tt_url, tt_user, yt_url, yt_user, primary_plat)
values
  ('otabek_muhammadalievich', 'Otabek Muhammadaliyev', 'UZ', 'entertainment', 'Юмор / Вайны', 37000000, 'https://instagram.com/otabek_muhammadalievich', 'otabek_muhammadalievich', 'https://tiktok.com/@otabek_muhammadalievich', 'otabek_muhammadalievich', null, null, 'instagram'),
  ('shaxzoda__muxammedova', 'Shaxzoda Muxammedova', 'UZ', 'fashion', 'Лайфстайл / Мода', 6400000, 'https://instagram.com/shaxzoda__muxammedova', 'shaxzoda__muxammedova', null, null, null, null, 'instagram'),
  ('jahongir_xojayev', 'Jahongir Xo''jayev', 'UZ', 'entertainment', 'Юмор / Вайны', 5800000, 'https://instagram.com/jahongir_xojayev', 'jahongir_xojayev', null, null, null, null, 'instagram'),
  ('leo_17s', 'Shaxzoda Salimjanova (Leo)', 'UZ', 'fashion', 'Мода / Лайфстайл', 1300000, 'https://instagram.com/leo_17s', 'leo_17s', null, null, null, null, 'instagram'),
  ('liil.khuramov', 'Liil Xo''ramov', 'UZ', 'entertainment', 'Юмор / Вайны', 2000000, 'https://instagram.com/liil.khuramov', 'liil.khuramov', null, null, null, null, 'instagram'),
  ('xanna__official', 'Xanna', 'UZ', 'entertainment', 'Юмор / Вайны', 1500000, 'https://instagram.com/xanna__official', 'xanna__official', null, null, null, null, 'instagram'),
  ('azodaofficial', 'Azoda', 'UZ', 'entertainment', 'Юмор / Развлечения', 1400000, 'https://instagram.com/azodaofficial', 'azodaofficial', null, null, null, null, 'instagram'),
  ('shahzoda_m', 'Shahzoda Muhammedova', 'UZ', 'fashion', 'Мода', 1200000, 'https://instagram.com/shahzoda_m', 'shahzoda_m', null, null, null, null, 'instagram'),
  ('parizoda__usmanova', 'Parizoda Usmanova', 'UZ', 'lifestyle', 'Лайфстайл / Семья', 2100000, 'https://instagram.com/parizoda__usmanova', 'parizoda__usmanova', null, null, null, null, 'instagram'),
  ('mittivine', 'Mittivine', 'UZ', 'entertainment', 'Юмор / Вайны', 887000, 'https://instagram.com/mittivine', 'mittivine', null, null, null, null, 'instagram'),
  ('alixonov__timur', 'Alixonov Timur', 'UZ', 'entertainment', 'Юмор / Семья', 649000, 'https://instagram.com/alixonov__timur', 'alixonov__timur', null, null, null, null, 'instagram'),
  ('gimandinova_official', 'Gimandinova', 'UZ', 'entertainment', 'Юмор / Вайны', 553000, 'https://instagram.com/gimandinova_official', 'gimandinova_official', null, null, null, null, 'instagram'),
  ('ziyosh_prod', 'Ziyosh Prod', 'UZ', 'entertainment', 'Юмор / Вайны', 442000, 'https://instagram.com/ziyosh_prod', 'ziyosh_prod', null, null, null, null, 'instagram'),
  ('sakhievvv', 'Sakhievvv', 'UZ', 'entertainment', 'Юмор / Вайны', 421000, 'https://instagram.com/sakhievvv', 'sakhievvv', null, null, null, null, 'instagram'),
  ('muborakabdullayevaa', 'Muborak Abdullayeva', 'UZ', 'entertainment', 'Юмор / Вайны', 353000, 'https://instagram.com/muborakabdullayevaa', 'muborakabdullayevaa', null, null, null, null, 'instagram'),
  ('nigora_abdullahanova', 'Nigora Abdullaxanova', 'UZ', 'entertainment', 'Юмор / Вайны', 255000, 'https://instagram.com/nigora_abdullahanova', 'nigora_abdullahanova', null, null, null, null, 'instagram'),
  ('azizahalilova', 'Aziza Xalilova', 'UZ', 'lifestyle', 'Лайфстайл', 438000, 'https://instagram.com/azizahalilova', 'azizahalilova', null, null, null, null, 'instagram'),
  ('khusnorik', 'Xusnora Shadiyeva', 'UZ', 'fashion', 'Мода / Лайфстайл', 438000, 'https://instagram.com/khusnorik', 'khusnorik', null, null, null, null, 'instagram'),
  ('ganyausman', 'Ganya Usman', 'UZ', 'lifestyle', 'Лайфстайл', 376000, 'https://instagram.com/ganyausman', 'ganyausman', null, null, null, null, 'instagram'),
  ('_shateni_', 'Farangiz Pulatova', 'UZ', 'fashion', 'Мода / Fashion', 294000, 'https://instagram.com/_shateni_', '_shateni_', null, null, null, null, 'instagram'),
  ('ruhsoraemm', 'Ruxsora Mirjalilova', 'UZ', 'entertainment', 'Музыка / Лайфстайл', 135000, 'https://instagram.com/ruhsoraemm', 'ruhsoraemm', null, null, null, null, 'instagram'),
  ('mashatilly', 'Mariam Tillyaeva', 'UZ', 'fashion', 'Мода / Эстетика', 200000, 'https://instagram.com/mashatilly', 'mashatilly', null, null, null, null, 'instagram'),
  ('yunka_a', 'Yunetta Akopyan', 'UZ', 'fashion', 'Мода / Лайфстайл', 150000, 'https://instagram.com/yunka_a', 'yunka_a', null, null, null, null, 'instagram'),
  ('abrik.eleven', 'Abrorbek Axmedbеkov', 'UZ', 'business', 'Юмор / Бизнес', 300000, 'https://instagram.com/abrik.eleven', 'abrik.eleven', null, null, null, null, 'instagram'),
  ('mama.doda', 'Mama Doda (Shahzoda)', 'UZ', 'lifestyle', 'Семья / Мама', 222000, 'https://instagram.com/mama.doda', 'mama.doda', null, null, null, null, 'instagram'),
  ('yulduz_mav', 'Yulduz Mav', 'UZ', 'lifestyle', 'Семья / Лайфстайл', 134000, 'https://instagram.com/yulduz_mav', 'yulduz_mav', null, null, null, null, 'instagram'),
  ('familytravel.uz', 'Family Travel UZ', 'UZ', 'travel', 'Путешествия / Семья', 120000, 'https://instagram.com/familytravel.uz', 'familytravel.uz', null, null, null, null, 'instagram'),
  ('choynakningqopqogi', 'Choynakningqopqogi', 'UZ', 'lifestyle', 'Тематический блог', 221000, 'https://instagram.com/choynakningqopqogi', 'choynakningqopqogi', null, null, null, null, 'instagram'),
  ('mahira_ilzat', 'Mahira Ilzat', 'UZ', 'lifestyle', 'Тематический блог', 218000, 'https://instagram.com/mahira_ilzat', 'mahira_ilzat', null, null, null, null, 'instagram'),
  ('iroda_utarova', 'Iroda Utarova', 'UZ', 'lifestyle', 'Тематический блог', 119000, 'https://instagram.com/iroda_utarova', 'iroda_utarova', null, null, null, null, 'instagram'),
  ('diorasblog', 'Diorasblog', 'UZ', 'lifestyle', 'Тематический блог', 68000, 'https://instagram.com/diorasblog', 'diorasblog', null, null, null, null, 'instagram'),
  ('xotam.ikromov', 'Xotam Ikromov', 'UZ', 'business', 'Мотивация / Бизнес', 400000, 'https://instagram.com/xotam.ikromov', 'xotam.ikromov', 'https://tiktok.com/@xotam.ikromov', 'xotam.ikromov', null, null, 'instagram'),
  ('timur.015', 'Timur.015', 'UZ', 'entertainment', 'Развлечения', 200000, 'https://instagram.com/timur.015', 'timur.015', null, null, null, null, 'instagram'),
  ('dilnoza_kubayeva', 'Dilnoza Kubayeva', 'UZ', 'fashion', 'Кино / Мода', 500000, 'https://instagram.com/dilnoza_kubayeva', 'dilnoza_kubayeva', null, null, null, null, 'instagram'),
  ('munisa_rizayeva', 'Munisa Rizayeva', 'UZ', 'fashion', 'Музыка / Мода', 800000, 'https://instagram.com/munisa_rizayeva', 'munisa_rizayeva', null, null, null, null, 'instagram'),
  ('umidaodi.lova', 'Умида Одилова', 'UZ', 'entertainment', 'Лайфстайл / Юмор', 500000, null, null, 'https://tiktok.com/@umidaodi.lova', 'umidaodi.lova', null, null, 'tiktok'),
  ('jonyrinko', 'Jonyrinko', 'UZ', 'entertainment', 'Развлечения', 2000000, null, null, 'https://tiktok.com/@jonyrinko', 'jonyrinko', null, null, 'tiktok'),
  ('neparvinaofficial', 'Непарвина', 'UZ', 'entertainment', 'Лайфстайл / Юмор', 300000, null, null, 'https://tiktok.com/@neparvinaofficial', 'neparvinaofficial', null, null, 'tiktok'),
  ('oksukpaevak', 'Karina Oksukpaeva', 'KZ', 'lifestyle', 'Семья / Лайфстайл', 5000000, 'https://instagram.com/oksukpaevak', 'oksukpaevak', 'https://tiktok.com/@oksukpaevak', 'oksukpaevak', 'https://youtube.com/@oksukpaevak', 'oksukpaevak', 'instagram'),
  ('abylova_merey', 'Abylova Merey', 'KZ', 'fashion', 'Лайфстайл / Мода', 2200000, 'https://instagram.com/abylova_merey', 'abylova_merey', null, null, null, null, 'instagram'),
  ('madlen_bloggerka', 'Мадлен (Мадина)', 'KZ', 'lifestyle', 'Лайфстайл', 2100000, 'https://instagram.com/madlen_bloggerka', 'madlen_bloggerka', null, null, null, null, 'instagram'),
  ('zhenis_omarov', 'Жenis Omarov', 'KZ', 'entertainment', 'Юмор / Развлечения', 3200000, 'https://instagram.com/zhenis_omarov', 'zhenis_omarov', null, null, null, null, 'instagram'),
  ('arman_yusupov_kz', 'Arman Yusupov', 'KZ', 'business', 'Бизнес / Мотивация', 1500000, 'https://instagram.com/arman_yusupov_kz', 'arman_yusupov_kz', 'https://tiktok.com/@arman_yusupov_kz', 'arman_yusupov_kz', 'https://youtube.com/@armanyusupov', 'armanyusupov', 'instagram'),
  ('birzhan_ashim', 'Birzhan Ashim', 'KZ', 'entertainment', 'Юмор / Сатира', 1400000, 'https://instagram.com/birzhan_ashim', 'birzhan_ashim', null, null, 'https://youtube.com/@birzhanashim', 'birzhanashim', 'instagram'),
  ('ayym_seitmetova', 'Ayym Seitmetova', 'KZ', 'fashion', 'Лайфстайл / Мода', 1500000, 'https://instagram.com/ayym_seitmetova', 'ayym_seitmetova', null, null, null, null, 'instagram'),
  ('aminvitaminka', 'Aminvitaminka', 'KZ', 'entertainment', 'Семья / Юмор', 1300000, 'https://instagram.com/aminvitaminka', 'aminvitaminka', null, null, null, null, 'instagram'),
  ('artur_askaruly', 'Artur Askaruly', 'KZ', 'entertainment', 'Юмор / Вайны', 910000, 'https://instagram.com/artur_askaruly', 'artur_askaruly', null, null, null, null, 'instagram'),
  ('zheka_fatbelly', 'Zheka Fatbelly', 'KZ', 'entertainment', 'Юмор / Интервью', 1000000, 'https://instagram.com/zheka_fatbelly', 'zheka_fatbelly', 'https://tiktok.com/@zhekafatbelly', 'zhekafatbelly', 'https://youtube.com/@zhekafatbelly', 'zhekafatbelly', 'instagram'),
  ('moldir_zhiyenbayeva', 'Moldir Zhiyenbayeva', 'KZ', 'travel', 'Путешествия / Лайфстайл', 1300000, 'https://instagram.com/moldir_zhiyenbayeva', 'moldir_zhiyenbayeva', null, null, null, null, 'instagram'),
  ('ramina_almas_official', 'Ramina Almas', 'KZ', 'entertainment', 'Музыка / Семья', 800000, 'https://instagram.com/ramina_almas_official', 'ramina_almas_official', null, null, null, null, 'instagram'),
  ('tansholpan_shotaeva', 'Tansholpan Shotaeva', 'KZ', 'lifestyle', 'Семья / Лайфстайл', 700000, 'https://instagram.com/tansholpan_shotaeva', 'tansholpan_shotaeva', null, null, null, null, 'instagram'),
  ('kaltaeva.janat', 'Жанат Калтаева', 'KZ', 'entertainment', 'Семья / Юмор', 600000, 'https://instagram.com/kaltaeva.janat', 'kaltaeva.janat', null, null, null, null, 'instagram'),
  ('rakhmonov_chikadze', 'Shavkat Rakhmonov', 'KZ', 'sports', 'Спорт / UFC', 2000000, 'https://instagram.com/rakhmonov_chikadze', 'rakhmonov_chikadze', null, null, null, null, 'instagram'),
  ('sabina_movlaeva', 'Sabina Movlaeva', 'KZ', 'entertainment', 'Музыка / Лайфстайл', 500000, 'https://instagram.com/sabina_movlaeva', 'sabina_movlaeva', null, null, null, null, 'instagram'),
  ('zhaksygen_n', 'Zhaksygen N', 'KZ', 'lifestyle', 'Лайфстайл', 1700000, 'https://instagram.com/zhaksygen_n', 'zhaksygen_n', null, null, null, null, 'instagram'),
  ('yeldos_kadirkhanov', 'Yeldos Kadirkhanov', 'KZ', 'entertainment', 'Юмор / Семья', 900000, 'https://instagram.com/yeldos_kadirkhanov', 'yeldos_kadirkhanov', null, null, null, null, 'instagram'),
  ('nurtaza_nurbek', 'Nurtaza Nurbek', 'KZ', 'business', 'Семья / Мотивация', 500000, 'https://instagram.com/nurtaza_nurbek', 'nurtaza_nurbek', null, null, null, null, 'instagram'),
  ('zhanatuly_medet', 'Zhanatuly Medet', 'KZ', 'sports', 'Фитнес / Мотивация', 600000, 'https://instagram.com/zhanatuly_medet', 'zhanatuly_medet', null, null, null, null, 'instagram'),
  ('erke_esmahan', 'Erke Esmahan', 'KZ', 'entertainment', 'Музыка', 700000, 'https://instagram.com/erke_esmahan', 'erke_esmahan', null, null, null, null, 'instagram'),
  ('kagiris_twins', 'Kagiris Twins', 'KZ', 'lifestyle', 'Лайфстайл / Близнецы', 3000000, null, null, 'https://tiktok.com/@kagiris_twins', 'kagiris_twins', null, null, 'tiktok'),
  ('aruzhan_mambetali', 'Aruzhan Mambetali', 'KZ', 'lifestyle', 'Семья / Лайфстайл', 1000000, null, null, 'https://tiktok.com/@aruzhan_mambetali', 'aruzhan_mambetali', null, null, 'tiktok'),
  ('moldirzhiyenbayeva', 'Moldir (TikTok)', 'KZ', 'travel', 'Путешествия / Лайфстайл', 5000000, null, null, 'https://tiktok.com/@moldirzhiyenbayeva', 'moldirzhiyenbayeva', null, null, 'tiktok'),
  ('aigerim_rasul_kyzy', 'Aigerim Rasul Kyzy', 'KG', 'fashion', 'Лайфстайл / Мода', 6000000, 'https://instagram.com/aigerim_rasul_kyzy', 'aigerim_rasul_kyzy', null, null, null, null, 'instagram'),
  ('samarakarimovasinger', 'Samara Karimova', 'KG', 'entertainment', 'Музыка / Лайфстайл', 3700000, 'https://instagram.com/samarakarimovasinger', 'samarakarimovasinger', null, null, null, null, 'instagram'),
  ('mirbek_atabekov', 'Mirbek Atabekov', 'KG', 'entertainment', 'Музыка', 2000000, 'https://instagram.com/mirbek_atabekov', 'mirbek_atabekov', null, null, null, null, 'instagram'),
  ('nurmat_sadyrov', 'Nurmat Sadyrov', 'KG', 'entertainment', 'Лайфстайл / Юмор', 1200000, 'https://instagram.com/nurmat_sadyrov', 'nurmat_sadyrov', null, null, null, null, 'instagram'),
  ('guljigit.kalykov', 'Guljigit Kalykov', 'KG', 'lifestyle', 'Лайфстайл', 900000, 'https://instagram.com/guljigit.kalykov', 'guljigit.kalykov', null, null, null, null, 'instagram'),
  ('mirgul9_esenalieva', 'Mirgul Esenalieva', 'KG', 'fashion', 'Мода / Лайфстайл', 587000, 'https://instagram.com/mirgul9_esenalieva', 'mirgul9_esenalieva', null, null, null, null, 'instagram'),
  ('erjankadyrbekov_studio', 'Erjan Kadyrbekov', 'KG', 'lifestyle', 'Фото / Искусство', 210000, 'https://instagram.com/erjankadyrbekov_studio', 'erjankadyrbekov_studio', null, null, null, null, 'instagram'),
  ('nurlan_nasip', 'Nurlan Nasip', 'KG', 'entertainment', 'Музыка', 400000, 'https://instagram.com/nurlan_nasip', 'nurlan_nasip', null, null, null, null, 'instagram'),
  ('eldar_tynalieff', 'Eldar Tynalieff', 'KG', 'tech', 'Технологии / Гаджеты', 3000000, 'https://instagram.com/eldar_tynalieff', 'eldar_tynalieff', 'https://tiktok.com/@eldar_tynalieff', 'eldar_tynalieff', 'https://youtube.com/@eldartynalieff', 'eldartynalieff', 'tiktok'),
  ('dbillions_chicky', 'DBillions Chicky', 'KG', 'entertainment', 'Юмор / Развлечения', 900000, null, null, 'https://tiktok.com/@dbillions_chicky', 'dbillions_chicky', null, null, 'tiktok'),
  ('shabdanovaaa', 'Shabdanovaaa', 'KG', 'lifestyle', 'Лайфстайл', 775000, null, null, 'https://tiktok.com/@shabdanovaaa', 'shabdanovaaa', null, null, 'tiktok'),
  ('foureyes_eldana', 'Foureyes Eldana', 'KG', 'entertainment', 'Лайфстайл / Юмор', 465000, null, null, 'https://tiktok.com/@foureyes_eldana', 'foureyes_eldana', null, null, 'tiktok'),
  ('ohmybabyzee', 'Ohmybabyzee', 'KG', 'fashion', 'Мода / Лайфстайл', 300000, null, null, 'https://tiktok.com/@ohmybabyzee', 'ohmybabyzee', null, null, 'tiktok'),
  ('firuza_khafizova', 'Фируза Хафизова', 'TJ', 'entertainment', 'Музыка / Лайфстайл', 1500000, 'https://instagram.com/firuza_khafizova', 'firuza_khafizova', null, null, null, null, 'instagram'),
  ('nigina_amonkulova', 'Нигина Амонкулова', 'TJ', 'entertainment', 'Музыка', 1000000, 'https://instagram.com/nigina_amonkulova', 'nigina_amonkulova', null, null, null, null, 'instagram'),
  ('manizha_davlatova', 'Манижа Давлатова', 'TJ', 'lifestyle', 'Лайфстайл', 500000, 'https://instagram.com/manizha_davlatova', 'manizha_davlatova', null, null, null, null, 'instagram'),
  ('rustam_nazarov_tj', 'Рустам Назаров', 'TJ', 'entertainment', 'Юмор / Развлечения', 400000, 'https://instagram.com/rustam_nazarov_tj', 'rustam_nazarov_tj', null, null, null, null, 'instagram'),
  ('gulnoza_safarova_tj', 'Гулноза Сафарова', 'TJ', 'food', 'Кулинария', 300000, 'https://instagram.com/gulnoza_safarova_tj', 'gulnoza_safarova_tj', null, null, null, null, 'instagram'),
  ('khabib_nurmagomedov', 'Khabib Nurmagomedov', 'RU', 'sports', 'Спорт / UFC', 39000000, 'https://instagram.com/khabib_nurmagomedov', 'khabib_nurmagomedov', null, null, null, null, 'instagram'),
  ('gusein.gasanov', 'Гусейн Гасанов', 'RU', 'business', 'Бизнес / Мотивация', 30000000, 'https://instagram.com/gusein.gasanov', 'gusein.gasanov', null, null, null, null, 'instagram'),
  ('rudkovskayaofficial', 'Яна Рудковская', 'RU', 'lifestyle', 'Лайфстайл / Светская жизнь', 5000000, 'https://instagram.com/rudkovskayaofficial', 'rudkovskayaofficial', null, null, null, null, 'instagram'),
  ('ida_galich', 'Ида Галич', 'RU', 'entertainment', 'Юмор / Лайфстайл', 8000000, 'https://instagram.com/ida_galich', 'ida_galich', null, null, null, null, 'instagram'),
  ('nastyaivleeva', 'Настя Ивлеева', 'RU', 'entertainment', 'Юмор / Развлечения', 20000000, 'https://instagram.com/nastyaivleeva', 'nastyaivleeva', null, null, null, null, 'instagram'),
  ('lerakudryavtseva', 'Лера Кудрявцева', 'RU', 'business', 'Лайфстайл / Шоу-бизнес', 6000000, 'https://instagram.com/lerakudryavtseva', 'lerakudryavtseva', null, null, null, null, 'instagram'),
  ('reginatodorenkoofficial', 'Регина Тодоренко', 'RU', 'travel', 'Семья / Путешествия', 7000000, 'https://instagram.com/reginatodorenkoofficial', 'reginatodorenkoofficial', null, null, null, null, 'instagram'),
  ('timur_batrutdinov', 'Тимур Батрутдинов', 'RU', 'business', 'Юмор / Шоу-бизнес', 3000000, 'https://instagram.com/timur_batrutdinov', 'timur_batrutdinov', null, null, null, null, 'instagram');

-- Idempotency: remove any real bloggers we inserted on a previous run
-- (identified by a matching instagram/tiktok/youtube profile_url).
delete from public.influencer_profiles ip
  where ip.user_id is null
    and exists (
      select 1 from public.social_platforms sp
      join _stg_bloggers s
        on sp.profile_url in (s.ig_url, s.tt_url, s.yt_url)
      where sp.influencer_id = ip.id
    );

-- ── 3. insert profiles + platforms + contact + history + queue ───────────────
do $$
declare
  r   _stg_bloggers%rowtype;
  pid uuid;
begin
  for r in select * from _stg_bloggers loop
    insert into public.influencer_profiles
      (user_id, display_name, bio, category, country, city,
       is_visible, avatar_url, onboarding_status, engagement_rate)
    values
      (null, r.display_name, r.category_raw, r.category, r.country, null,
       true, null, 'completed', null)
    returning id into pid;

    if r.ig_url is not null then
      insert into public.social_platforms
        (influencer_id, platform, username, followers_count, profile_url, is_primary)
      values
        (pid, 'instagram', r.ig_user,
         case when r.primary_plat = 'instagram' then r.followers end,
         r.ig_url, r.primary_plat = 'instagram');
    end if;
    if r.tt_url is not null then
      insert into public.social_platforms
        (influencer_id, platform, username, followers_count, profile_url, is_primary)
      values
        (pid, 'tiktok', r.tt_user,
         case when r.primary_plat = 'tiktok' then r.followers end,
         r.tt_url, r.primary_plat = 'tiktok');
    end if;
    if r.yt_url is not null then
      insert into public.social_platforms
        (influencer_id, platform, username, followers_count, profile_url, is_primary)
      values
        (pid, 'youtube', r.yt_user,
         case when r.primary_plat = 'youtube' then r.followers end,
         r.yt_url, r.primary_plat = 'youtube');
    end if;

    insert into public.influencer_contacts (influencer_id, instagram_dm)
      values (pid, r.ig_user);

    insert into public.influencer_analytics_history
      (influencer_id, platform, followers_count)
      values (pid, r.primary_plat, r.followers);

    insert into public.scraping_queue (influencer_id, status)
      values (pid, 'pending');
  end loop;
end $$;

-- ── 4. recompute league_rank by total followers ──────────────────────────────
with totals as (
  select ip.id,
         coalesce(sum(sp.followers_count), 0) as total
    from public.influencer_profiles ip
    left join public.social_platforms sp on sp.influencer_id = ip.id
   where ip.is_visible = true
   group by ip.id
),
ranked as (
  select id, row_number() over (order by total desc) as rn from totals
)
update public.influencer_profiles ip
   set league_rank = ranked.rn
  from ranked
 where ranked.id = ip.id;
