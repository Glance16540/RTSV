// Each people names its own (docs/DESIGN.md, 9ec6a51: "Each people names its own").
//
// The names a people gives its men and women, and the names of its houses, drawn from that people's own world: Norse
// names for the Norse, Latin for the Romans, Akkadian for Babylon, Manding for Mali, and so on. They are plain names of
// the kind those peoples gave, or the names of their clans, lineages and towns where a house went by its place or its
// clan rather than a surname. Nothing here is made up to be laughed at.
//
// Only the drawing of a new name reads these. A name once given is the person's: it goes with them when they move,
// marry, are carried off or freed, and a saved campaign keeps the names it has. A name the player chose (naming.ts)
// is never drawn over. A people these lists do not know (marauders and the like) draws from the band folk's.
export interface PeopleNames { m: readonly string[]; f: readonly string[]; houses: readonly string[] }

export const PEOPLE_NAMES: Record<string, PeopleNames> = {
  wild: {
    m: ['Arne', 'Bjorn', 'Dag', 'Einar', 'Erik', 'Finn', 'Gunnar', 'Halvard', 'Harald', 'Ivar', 'Knut', 'Leif', 'Magnus', 'Njal', 'Olaf', 'Ragnar', 'Rolf', 'Sigurd', 'Sten', 'Sven', 'Thorvald', 'Ulf', 'Vidar', 'Asger', 'Egil', 'Gisli', 'Hakon', 'Orm', 'Steinar', 'Torsten', 'Alrik', 'Bard', 'Eyvind', 'Grim', 'Hallstein', 'Ketil', 'Ottar', 'Sigvald', 'Thorgils', 'Vemund'],
    f: ['Alfhild', 'Astrid', 'Bergljot', 'Dagny', 'Eir', 'Freydis', 'Gudrun', 'Gunhild', 'Gyda', 'Helga', 'Hild', 'Ingrid', 'Jorunn', 'Ragnhild', 'Ragna', 'Runa', 'Sigrid', 'Solveig', 'Svanhild', 'Thora', 'Thyra', 'Tove', 'Unn', 'Vigdis', 'Yrsa', 'Aslaug', 'Halldora', 'Ingunn', 'Asa', 'Bodil', 'Aud', 'Gerd', 'Hallgerd', 'Ingeborg', 'Ragnfrid', 'Signy', 'Sigrun', 'Thorbjorg', 'Thorunn', 'Valgerd'],
    houses: ['Ask', 'Berg', 'Dal', 'Fjeld', 'Haug', 'Holm', 'Lund', 'Moe', 'Nes', 'Rud', 'Strand', 'Vik', 'Aas', 'Brekke', 'Eide', 'Foss', 'Hagen', 'Lie', 'Myhre', 'Naes', 'Oien', 'Rise', 'Saeter', 'Skog', 'Tveit', 'Vang', 'Aker', 'Bakke', 'Hovde', 'Sand'],
  },
  england: {
    m: ['Aelfric', 'Alfred', 'Baldwin', 'Bertram', 'Cedric', 'Cuthbert', 'Edgar', 'Edmund', 'Edric', 'Edward', 'Edwin', 'Geoffrey', 'Gilbert', 'Godric', 'Godwin', 'Harold', 'Henry', 'Hugh', 'Leofric', 'Osric', 'Oswald', 'Ralph', 'Richard', 'Robert', 'Roger', 'Simon', 'Thomas', 'Walter', 'William', 'Wulfstan', 'Ailwin', 'Brihtric', 'Eadric', 'Gamel', 'Hereward', 'Ivo', 'Lambert', 'Nigel', 'Siward', 'Wulfric'],
    f: ['Adela', 'Agnes', 'Alice', 'Aldith', 'Amice', 'Beatrice', 'Cecily', 'Edith', 'Eleanor', 'Elfreda', 'Emma', 'Godiva', 'Gytha', 'Hawise', 'Isabel', 'Joan', 'Juliana', 'Leofrun', 'Mabel', 'Margery', 'Matilda', 'Maud', 'Petronilla', 'Rohesia', 'Rosamund', 'Sybil', 'Wulfrun', 'Avice', 'Isolda', 'Alyson', 'Aelfgifu', 'Ealdgyth', 'Emeline', 'Ermengarde', 'Githa', 'Hilda', 'Ida', 'Lettice', 'Muriel', 'Wymarc'],
    houses: ['Ashford', 'Blackmoor', 'Bramley', 'Carver', 'Cotter', 'Dale', 'Fenwick', 'Fletcher', 'Hayward', 'Heathcote', 'Holloway', 'Mercer', 'Millward', 'Penrose', 'Ridley', 'Shepherd', 'Tanner', 'Thatcher', 'Wainwright', 'Westbrook', 'Woodward', 'Ashby', 'Harrow', 'Marsh', 'Pike', 'Redfern', 'Thorne', 'Underhill', 'Coldwell', 'Oakes'],
  },
  hearth: {
    m: ['Adalbert', 'Aldric', 'Ansgar', 'Arnulf', 'Baldric', 'Bernard', 'Carloman', 'Childebert', 'Clovis', 'Dagobert', 'Eberhard', 'Einhard', 'Gerold', 'Gozbert', 'Grimoald', 'Hildebrand', 'Hugo', 'Lothar', 'Odo', 'Pepin', 'Radbod', 'Ragnachar', 'Rainald', 'Rodolf', 'Sigibert', 'Theodoric', 'Theudebert', 'Waldo', 'Warin', 'Wido', 'Anskar', 'Benedikt', 'Dodo', 'Ebroin', 'Fulrad', 'Gundobad', 'Hincmar', 'Leudast', 'Mummolus', 'Ricfrid'],
    f: ['Adelheid', 'Aldegund', 'Bertha', 'Bertrada', 'Brunhild', 'Chlotilde', 'Ermengard', 'Fastrada', 'Gisela', 'Gertrude', 'Hildegard', 'Himiltrude', 'Irmina', 'Liutgard', 'Mathilde', 'Ota', 'Plectrude', 'Radegund', 'Regina', 'Richilde', 'Rotrude', 'Theodrada', 'Waldrada', 'Willa', 'Amalberga', 'Berthilde', 'Emma', 'Ingeltrude', 'Oda', 'Adela', 'Adalgard', 'Bilichild', 'Chrodechild', 'Deuteria', 'Engelberga', 'Fredegund', 'Gerberga', 'Hiltrude', 'Ragnetrude', 'Sichilde'],
    houses: ['Aubert', 'Bertin', 'Chalon', 'Dreux', 'Evreux', 'Flavigny', 'Gerberoy', 'Hesbaye', 'Laon', 'Lorsch', 'Meaux', 'Metz', 'Montfort', 'Nevers', 'Noyon', 'Poitiers', 'Reims', 'Rouen', 'Senlis', 'Soissons', 'Toul', 'Tours', 'Verdun', 'Vermand', 'Autun', 'Blois', 'Corbie', 'Melun', 'Sens', 'Troyes'],
  },
  stonekin: {
    m: ['Aulus', 'Decimus', 'Gaius', 'Gnaeus', 'Lucius', 'Marcus', 'Publius', 'Quintus', 'Servius', 'Sextus', 'Spurius', 'Titus', 'Tiberius', 'Manius', 'Appius', 'Numerius', 'Vibius', 'Postumus', 'Faustus', 'Agrippa', 'Cassius', 'Felix', 'Florus', 'Gallus', 'Lepidus', 'Marcellus', 'Nerva', 'Rufus', 'Severus', 'Varro', 'Caelius', 'Crispus', 'Fronto', 'Laelius', 'Maximus', 'Paullus', 'Priscus', 'Sabinus', 'Tertius', 'Vitalis'],
    f: ['Aelia', 'Antonia', 'Aurelia', 'Caecilia', 'Claudia', 'Cornelia', 'Domitia', 'Fabia', 'Flavia', 'Fulvia', 'Julia', 'Junia', 'Livia', 'Lucretia', 'Marcia', 'Octavia', 'Plautia', 'Pompeia', 'Porcia', 'Sabina', 'Servilia', 'Sulpicia', 'Terentia', 'Tullia', 'Valeria', 'Vibia', 'Calpurnia', 'Licinia', 'Minicia', 'Placidia', 'Aemilia', 'Cassia', 'Clodia', 'Didia', 'Galeria', 'Hortensia', 'Iulia', 'Lollia', 'Petronia', 'Statilia'],
    houses: ['Aemilius', 'Antonius', 'Aurelius', 'Caecilius', 'Calpurnius', 'Claudius', 'Cornelius', 'Domitius', 'Fabius', 'Flavius', 'Fulvius', 'Julius', 'Junius', 'Licinius', 'Livius', 'Marcius', 'Octavius', 'Plautius', 'Pompeius', 'Porcius', 'Sempronius', 'Servilius', 'Sulpicius', 'Terentius', 'Tullius', 'Valerius', 'Manlius', 'Papirius', 'Quinctius', 'Vettius'],
  },
  greece: {
    m: ['Ariston', 'Kallias', 'Damon', 'Demetrios', 'Dion', 'Euthymos', 'Glaukos', 'Hermon', 'Hippias', 'Ion', 'Kleon', 'Kritias', 'Lykon', 'Lysander', 'Menon', 'Nikias', 'Philon', 'Phaidon', 'Polemon', 'Sostratos', 'Theron', 'Timon', 'Xenon', 'Zenon', 'Androkles', 'Charmides', 'Diodoros', 'Eudoxos', 'Kimon', 'Perikles', 'Alkibiades', 'Aristeides', 'Demosthenes', 'Epameinondas', 'Hieron', 'Kallikrates', 'Leonidas', 'Pausanias', 'Thrasyboulos', 'Xenophon'],
    f: ['Agathe', 'Aspasia', 'Chloe', 'Daphne', 'Eirene', 'Elpis', 'Eudokia', 'Euphemia', 'Gorgo', 'Hermione', 'Kallisto', 'Kleo', 'Lysandra', 'Melissa', 'Myrrhine', 'Nikaia', 'Pelagia', 'Phaidra', 'Philippa', 'Phoibe', 'Praxilla', 'Sappho', 'Theano', 'Thekla', 'Xanthe', 'Zoe', 'Agariste', 'Kallirhoe', 'Arete', 'Damaris', 'Andromache', 'Berenike', 'Eurydike', 'Glykera', 'Harmonia', 'Iphis', 'Korinna', 'Lamia', 'Nausikaa', 'Timareta'],
    houses: ['Acharnai', 'Alopeke', 'Aphidna', 'Brauron', 'Dekeleia', 'Eleusis', 'Erchia', 'Kephisia', 'Kolonos', 'Kydathenaion', 'Lamptrai', 'Marathon', 'Melite', 'Oe', 'Paiania', 'Peiraieus', 'Phaleron', 'Phlya', 'Probalinthos', 'Rhamnous', 'Sounion', 'Thorikos', 'Anagyrous', 'Halai', 'Ikarion', 'Kerameis', 'Lakiadai', 'Myrrhinous', 'Pallene', 'Sphettos'],
  },
  dawn: {
    m: ['Abda', 'Abiel', 'Adon', 'Ammi', 'Azaz', 'Barhadad', 'Barak', 'Dadi', 'Elyada', 'Ezra', 'Gabbar', 'Hanun', 'Hazael', 'Iddo', 'Kalbu', 'Malik', 'Mati', 'Nathan', 'Obed', 'Rezin', 'Tabrimmon', 'Talmai', 'Toi', 'Ura', 'Yaush', 'Zakkur', 'Zabdi', 'Yaqim', 'Hiram', 'Adoniram', 'Asa', 'Benhadad', 'Eliab', 'Gedaliah', 'Hadad', 'Jabin', 'Kalab', 'Mattan', 'Shobi', 'Tobiah'],
    f: ['Abital', 'Adah', 'Ahinoam', 'Basemath', 'Bilha', 'Dinah', 'Hadassa', 'Hanna', 'Keturah', 'Leah', 'Maacah', 'Maryam', 'Milcah', 'Naamah', 'Noa', 'Peninnah', 'Rachel', 'Rebekah', 'Sarai', 'Shiphra', 'Tamar', 'Tirza', 'Yael', 'Zilpah', 'Zipporah', 'Atara', 'Elisheva', 'Huldah', 'Michal', 'Shelomit', 'Abigail', 'Azubah', 'Dvora', 'Gomer', 'Jemima', 'Keziah', 'Naomi', 'Rizpah', 'Ruth', 'Serah'],
    houses: ['Bit-Adini', 'Bit-Agusi', 'Bit-Bahiani', 'Bit-Gabbari', 'Bit-Halupe', 'Bit-Zamani', 'Bit-Yakin', 'Bit-Dakkuri', 'Bit-Amukani', 'Bit-Rehob', 'Arpad', 'Hamath', 'Guzana', 'Tadmor', 'Harran', 'Hadrach', 'Halab', 'Qatna', 'Zobah', 'Kadesh', 'Ugarit', 'Nisibis', 'Edessa', 'Mari', 'Terqa', 'Emar', 'Karkemish', 'Tunip', 'Ebla', 'Arwad'],
  },
  babylon: {
    m: ['Abum', 'Ahuni', 'Apilsin', 'Arad', 'Awilum', 'Balasi', 'Belshunu', 'Bunene', 'Eriba', 'Gimillu', 'Hunabu', 'Ibni', 'Iddin', 'Ilubani', 'Ishmedagan', 'Kudurru', 'Mushezib', 'Nabutu', 'Nidinti', 'Rimut', 'Shulgi', 'Sinbani', 'Sumuel', 'Tabni', 'Ubar', 'Warad', 'Zimri', 'Marduka', 'Shamshi', 'Enlilbani', 'Adadiddin', 'Belibni', 'Eaimuqi', 'Gudea', 'Ilushu', 'Ludlul', 'Marduknasir', 'Nabonidus', 'Sinidinnam', 'Ummanu'],
    f: ['Abitum', 'Ahati', 'Amatshamash', 'Belessunu', 'Beltani', 'Damiqtum', 'Ereshti', 'Hunabatum', 'Humusi', 'Iltani', 'Inibsha', 'Ishtarummi', 'Kubutum', 'Lamassi', 'Liwwirsha', 'Mattatum', 'Naramtum', 'Qishtum', 'Rubatum', 'Shataya', 'Shibtu', 'Shuqurtum', 'Tabniya', 'Taram', 'Ummi', 'Yahatti', 'Zakiti', 'Zaziya', 'Belti', 'Amtum', 'Adda', 'Bitinuri', 'Ennanatum', 'Gemeti', 'Ishtarnadin', 'Kishar', 'Magiltum', 'Ninlilzimu', 'Shalamtum', 'Tukultum'],
    houses: ['Egibi', 'Nursin', 'Murashu', 'Eailutubani', 'Sindamaqu', 'Ahubani', 'Gahal', 'Shanashishu', 'Atkuppu', 'Nappahu', 'Ishparu', 'Rabbani', 'Tabihu', 'Ararru', 'Bairu', 'Malahu', 'Purkullu', 'Mandidu', 'Ileimarduk', 'Babutu', 'Dabibi', 'Kidinmarduk', 'Sinimitti', 'Paharu', 'Asu', 'Isinnaya', 'Hanbu', 'Dannea', 'Basia', 'Sangu'],
  },
  persia: {
    m: ['Artabanus', 'Arsames', 'Ariaramnes', 'Artaxerxes', 'Bardiya', 'Datis', 'Gaubaruva', 'Hydarnes', 'Intaphernes', 'Mardonius', 'Masistes', 'Otanes', 'Pharnaces', 'Spitamenes', 'Tiridates', 'Vidarna', 'Vindafarna', 'Vishtaspa', 'Xerxes', 'Artabazus', 'Ariobarzanes', 'Aspathines', 'Bagapates', 'Farnadata', 'Mithradata', 'Orontes', 'Tissaphernes', 'Zopyrus', 'Megabyzus', 'Arshama', 'Abradatas', 'Artasyras', 'Bagoas', 'Cyrus', 'Darius', 'Gobryas', 'Hystaspes', 'Oxyartes', 'Pharnabazus', 'Smerdis'],
    f: ['Amestris', 'Amytis', 'Apama', 'Artystone', 'Atossa', 'Damaspia', 'Irdabama', 'Parmys', 'Parysatis', 'Phaidyme', 'Rhodogune', 'Roxana', 'Sisygambis', 'Stateira', 'Artakama', 'Barsine', 'Drypetis', 'Mandane', 'Pantea', 'Shirin', 'Banu', 'Denak', 'Purandokht', 'Azarmidokht', 'Gordiya', 'Kassandane', 'Udusana', 'Aryenis', 'Artonis', 'Ardushduka', 'Arsinoe', 'Artaynte', 'Barzine', 'Dareia', 'Hutaosa', 'Mahdukht', 'Nanaia', 'Raodaxsha', 'Tigranuhi', 'Zarine'],
    houses: ['Suren', 'Karen', 'Mihran', 'Ispahbudhan', 'Spandiyadh', 'Zik', 'Varaz', 'Andigan', 'Pasargadae', 'Maraphii', 'Maspii', 'Panthialaei', 'Derusiaei', 'Germanii', 'Daai', 'Mardi', 'Dropici', 'Sagartii', 'Hakhamanish', 'Pahlav', 'Parsa', 'Kayan', 'Pishdad', 'Frataraka', 'Utii', 'Mykoi', 'Bagadati', 'Vahbarz', 'Hyrkani', 'Arii'],
  },
  arabs: {
    m: ['Abbas', 'Ahmad', 'Ali', 'Bakr', 'Dawud', 'Fadl', 'Faris', 'Hamid', 'Harun', 'Hasan', 'Husayn', 'Ibrahim', 'Idris', 'Ishaq', 'Ismail', 'Jafar', 'Khalid', 'Mahmud', 'Mansur', 'Musa', 'Nasr', 'Qasim', 'Rashid', 'Said', 'Salih', 'Sulayman', 'Tahir', 'Umar', 'Yahya', 'Yusuf', 'Zayd', 'Abdallah', 'Amr', 'Bashir', 'Hisham', 'Malik', 'Marwan', 'Nuh', 'Thabit', 'Uthman', 'Walid'],
    f: ['Aisha', 'Amina', 'Asma', 'Fatima', 'Habiba', 'Hafsa', 'Hind', 'Jamila', 'Khadija', 'Khayzuran', 'Layla', 'Lubna', 'Maryam', 'Maymuna', 'Nafisa', 'Najla', 'Nur', 'Qamar', 'Rabia', 'Ruqayya', 'Safiyya', 'Salma', 'Sawda', 'Shams', 'Sukayna', 'Ulayya', 'Wallada', 'Yasmin', 'Zaynab', 'Zubayda', 'Zahra', 'Abla', 'Atika', 'Buran', 'Dananir', 'Ghalia', 'Ibna', 'Jumana', 'Mahbuba', 'Sitt', 'Unaysa'],
    houses: ['Barmaki', 'Hashimi', 'Qurayshi', 'Tamimi', 'Azdi', 'Bakri', 'Kalbi', 'Kindi', 'Ansari', 'Makhzumi', 'Thaqafi', 'Taghlibi', 'Asadi', 'Hamdani', 'Shaybani', 'Tai', 'Juhani', 'Khazraji', 'Awsi', 'Muhallabi', 'Tahiri', 'Baghdadi', 'Basri', 'Kufi', 'Dimashqi', 'Halabi', 'Misri', 'Mawsili', 'Wasiti', 'Hijazi'],
  },
  egypt: {
    m: ['Ahmose', 'Amenemhat', 'Amenhotep', 'Ankhu', 'Bak', 'Djedi', 'Hapu', 'Harkhuf', 'Hor', 'Ineni', 'Intef', 'Ipuy', 'Kha', 'Khaemwaset', 'Mahu', 'Maya', 'Meryre', 'Nakht', 'Nebamun', 'Neferhotep', 'Paser', 'Pentu', 'Ptahhotep', 'Rekhmire', 'Senenmut', 'Sennedjem', 'Sobekhotep', 'Weni', 'Userhat', 'Yuya', 'Amenemope', 'Huy', 'Inherkhau', 'Khonsu', 'Menna', 'Nebre', 'Panehesy', 'Ramose', 'Senusret', 'Tjanuny'],
    f: ['Ankhesen', 'Baketamun', 'Henuttawy', 'Hatnefer', 'Iset', 'Iuy', 'Kawit', 'Khenut', 'Merit', 'Meritamun', 'Mutnodjmet', 'Nebet', 'Nefertari', 'Neferure', 'Nodjmet', 'Nubkhaes', 'Satamun', 'Senet', 'Sitre', 'Takhat', 'Tiye', 'Tuya', 'Tey', 'Henut', 'Ipwet', 'Isetnofret', 'Nebettawy', 'Tentopet', 'Iah', 'Sobekneferu', 'Hemetre', 'Hathor', 'Iti', 'Mutemwia', 'Nefer', 'Ruiu', 'Sitamun', 'Tabes', 'Taweret', 'Wiay'],
    houses: ['Abydos', 'Akhmim', 'Asyut', 'Bubastis', 'Buto', 'Dendera', 'Edfu', 'Elephantine', 'Esna', 'Heliopolis', 'Herakleopolis', 'Hermopolis', 'Ombos', 'Koptos', 'Memphis', 'Mendes', 'Nekhen', 'Nekheb', 'Sais', 'Tanis', 'Thebes', 'Thinis', 'Busiris', 'Athribis', 'Letopolis', 'Sebennytos', 'Xois', 'Medamud', 'Armant', 'Hebenu'],
  },
  steppe: {
    m: ['Altan', 'Arslan', 'Batu', 'Bayan', 'Belgutei', 'Boorchu', 'Chagatai', 'Chilaun', 'Daritai', 'Jebe', 'Jelme', 'Jochi', 'Khasar', 'Kublai', 'Mongke', 'Muqali', 'Nayan', 'Ogedei', 'Sorkhan', 'Subotai', 'Temuge', 'Tolui', 'Toghrul', 'Toqto', 'Yesugei', 'Yesun', 'Arigh', 'Berke', 'Hulagu', 'Kaidu', 'Abaqa', 'Baidar', 'Buqa', 'Chormaqan', 'Dayir', 'Esen', 'Ganbold', 'Mengu', 'Qutuz', 'Uriyang'],
    f: ['Alaqai', 'Borte', 'Chabi', 'Checheyigen', 'Ebegei', 'Hoelun', 'Ibaqa', 'Khutulun', 'Khulan', 'Mandukhai', 'Qojin', 'Sorghaghtani', 'Toregene', 'Yesui', 'Yesugen', 'Doquz', 'Nomolun', 'Altani', 'Boraqchin', 'Kokochin', 'Qutui', 'Tolun', 'Saran', 'Bayalun', 'Gerel', 'Naran', 'Tuya', 'Sarnai', 'Odval', 'Gurbesu', 'Abaqai', 'Bulughan', 'Erdene', 'Gegeen', 'Altaluun', 'Maral', 'Oyun', 'Sechen', 'Tsetseg', 'Ulzii'],
    houses: ['Borjigin', 'Khongirad', 'Jalair', 'Merkit', 'Kereit', 'Naiman', 'Oirat', 'Uriankhai', 'Barlas', 'Baarin', 'Besud', 'Manghud', 'Uruud', 'Arulad', 'Sunid', 'Taichiud', 'Olkhonud', 'Ikires', 'Khatagin', 'Saljiud', 'Dorben', 'Jurkin', 'Bayaud', 'Qorulas', 'Ongud', 'Tumed', 'Chahar', 'Khalkha', 'Ordos', 'Kharchin'],
  },
  forge: {
    m: ['Anshi', 'Bai', 'Bin', 'Chao', 'Chong', 'Da', 'De', 'Fu', 'Guang', 'Hao', 'Heng', 'Hong', 'Jian', 'Jun', 'Kang', 'Lin', 'Ming', 'Ning', 'Qiang', 'Ren', 'Rui', 'Shan', 'Tai', 'Wei', 'Wen', 'Xian', 'Xiu', 'Yan', 'Yong', 'Zhen', 'Bo', 'Cheng', 'Dong', 'Gui', 'Hai', 'Jie', 'Kai', 'Long', 'Peng', 'Song'],
    f: ['Ai', 'Bao', 'Chun', 'Fang', 'Hua', 'Hui', 'Jia', 'Jing', 'Juan', 'Lan', 'Li', 'Lian', 'Ling', 'Mei', 'Min', 'Qing', 'Rong', 'Shu', 'Ting', 'Wan', 'Xia', 'Xue', 'Yi', 'Ying', 'Yu', 'Yun', 'Zhi', 'Su', 'Yue', 'Qiao', 'Cui', 'Dan', 'Fei', 'Huan', 'Jiao', 'Lu', 'Na', 'Ping', 'Xin', 'Xiang'],
    houses: ['Cao', 'Chen', 'Deng', 'Du', 'Fan', 'Gao', 'Guo', 'Han', 'He', 'Hu', 'Huang', 'Jiang', 'Lu', 'Liu', 'Ma', 'Song', 'Sun', 'Tang', 'Wang', 'Wu', 'Xu', 'Yang', 'Ye', 'Zhang', 'Zhao', 'Zhou', 'Zhu', 'Shen', 'Qin', 'Kong'],
  },
  japan: {
    m: ['Harunobu', 'Hirotsuna', 'Ietsuna', 'Kagetora', 'Kanetsugu', 'Kiyomori', 'Masakado', 'Masamune', 'Michinaga', 'Mitsunari', 'Morinaga', 'Munenori', 'Nagamasa', 'Narimasa', 'Nobunaga', 'Sadamitsu', 'Shigemori', 'Sukemasa', 'Tadamori', 'Takauji', 'Tokimune', 'Toshiie', 'Tsunemasa', 'Ujimasa', 'Yasumasa', 'Yorimasa', 'Yoritomo', 'Yoshiie', 'Yoshitsune', 'Kagekatsu', 'Hidemasa', 'Ieyasu', 'Kagetoki', 'Kanesada', 'Masanobu', 'Mototada', 'Nagahide', 'Takatora', 'Ujisato', 'Yoshimoto'],
    f: ['Akiko', 'Ayame', 'Chiyo', 'Fujiko', 'Hanako', 'Haruko', 'Kaede', 'Kiku', 'Kiyo', 'Masako', 'Matsu', 'Michiko', 'Natsu', 'Nene', 'Oichi', 'Otsu', 'Sachiko', 'Sada', 'Sen', 'Shizuka', 'Tama', 'Tokiko', 'Tomoe', 'Ume', 'Yae', 'Yasuko', 'Yodo', 'Yoshiko', 'Yuki', 'Kazuko', 'Chacha', 'Kiyohime', 'Hatsu', 'Kasuga', 'Kotoko', 'Mitsu', 'Oman', 'Sakiko', 'Teru', 'Tsuru'],
    houses: ['Abe', 'Akamatsu', 'Ashikaga', 'Date', 'Hojo', 'Hosokawa', 'Imagawa', 'Ii', 'Kikkawa', 'Kobayakawa', 'Maeda', 'Matsudaira', 'Miyoshi', 'Mori', 'Nagao', 'Oda', 'Ouchi', 'Rokkaku', 'Sanada', 'Satake', 'Shiba', 'Shimazu', 'Takeda', 'Tokugawa', 'Uesugi', 'Yamana', 'Asakura', 'Chosokabe', 'Ryuzoji', 'Otomo'],
  },
  mali: {
    m: ['Abubakari', 'Bakari', 'Dankaran', 'Fakoli', 'Faran', 'Kandia', 'Karamoko', 'Mamadi', 'Maghan', 'Moussa', 'Nare', 'Sakura', 'Sundiata', 'Souleymane', 'Tiramakan', 'Balla', 'Bilali', 'Kele', 'Madi', 'Sidi', 'Tamba', 'Wali', 'Kabine', 'Seydou', 'Mori', 'Kalla', 'Siriman', 'Djigui', 'Fode', 'Lassana', 'Aboubakar', 'Daouda', 'Gaoussou', 'Ibrahima', 'Lansine', 'Mahamadou', 'Ousmane', 'Sekou', 'Tieba', 'Yaya'],
    f: ['Assa', 'Awa', 'Bintou', 'Djeneba', 'Fanta', 'Fatoumata', 'Hawa', 'Kadiatou', 'Kankou', 'Kassi', 'Kadidia', 'Mariam', 'Mah', 'Nana', 'Nene', 'Niamoye', 'Oumou', 'Rokia', 'Salimata', 'Sira', 'Sogolon', 'Sokona', 'Tenin', 'Nassira', 'Aissata', 'Massaran', 'Nyeleni', 'Tiguida', 'Kamissa', 'Sitan', 'Djaba', 'Diaba', 'Koumba', 'Maimouna', 'Mariama', 'Nakani', 'Sali', 'Sanou', 'Soumba', 'Wassa'],
    houses: ['Keita', 'Traore', 'Kamara', 'Konate', 'Kone', 'Coulibaly', 'Diarra', 'Diallo', 'Toure', 'Cisse', 'Sylla', 'Doumbia', 'Fofana', 'Sissoko', 'Kante', 'Kouyate', 'Dembele', 'Sanogo', 'Bagayoko', 'Konare', 'Diabate', 'Sidibe', 'Tounkara', 'Sacko', 'Danioko', 'Magassa', 'Diakite', 'Koita', 'Samake', 'Tangara'],
  },
  kush: {
    m: ['Alara', 'Aramatelqo', 'Arkamani', 'Aspelta', 'Analmaye', 'Anlamani', 'Arnekhamani', 'Atlanersa', 'Harsiotef', 'Kashta', 'Malonaqen', 'Nastasen', 'Piye', 'Senkamanisken', 'Shabaka', 'Shebitku', 'Taharqa', 'Tanutamani', 'Teqorideamani', 'Yesbokheamani', 'Adikhalamani', 'Akinidad', 'Natakamani', 'Sherkarer', 'Tabirqo', 'Talakhamani', 'Amanibakhi', 'Irike', 'Karkamani', 'Amaniastabarqo', 'Amanikhabale', 'Arqamani', 'Baskakeren', 'Harkhebi', 'Kharamadoye', 'Malowiebamani', 'Nasakhma', 'Pisakar', 'Shorkaror', 'Yekeb'],
    f: ['Amanirenas', 'Amanishakheto', 'Amanitore', 'Amanikhatashan', 'Nawidemak', 'Shanakdakhete', 'Abar', 'Khensa', 'Tabiry', 'Peksater', 'Naparaye', 'Takahatenamun', 'Atakhebasken', 'Nasalsa', 'Madiqen', 'Amanimalel', 'Henuttakhebit', 'Piankharty', 'Yeturow', 'Batahaliye', 'Amanipilade', 'Pekareslo', 'Saktenen', 'Tagtaliye', 'Akhe', 'Wayekiye', 'Mernua', 'Arty', 'Asata', 'Pelkha', 'Amanikasheto', 'Bartare', 'Henutirdis', 'Kadimalo', 'Lakhideamani', 'Nahirqo', 'Nalatesa', 'Senamat', 'Tamari', 'Tawayi'],
    houses: ['Meroe', 'Napata', 'Kerma', 'Kawa', 'Sanam', 'Barkal', 'Nuri', 'Kurru', 'Musawwarat', 'Naqa', 'Banaqa', 'Kurgus', 'Faras', 'Ibrim', 'Soba', 'Dongola', 'Sedeinga', 'Amara', 'Kabushiya', 'Hamadab', 'Tabo', 'Buhen', 'Semna', 'Sai', 'Tombos', 'Argo', 'Mirgissa', 'Adda', 'Debeira', 'Karanog'],
  },
};

/** The band folk's names: marauders, tribes and anyone else these lists do not know. Their old shared lists. */
export const BAND_NAMES: PeopleNames = {
  m: ['Alder', 'Bram', 'Corin', 'Dunn', 'Edric', 'Fenn', 'Garrick', 'Holt', 'Ivo', 'Joss', 'Kell', 'Loric', 'Marn', 'Ned', 'Osric', 'Perrin', 'Rolf', 'Soren', 'Tam', 'Wend', 'Aldous', 'Ansel', 'Aric', 'Baldric', 'Bertram', 'Brand', 'Cedric', 'Colm', 'Cormac', 'Cuthbert', 'Dagan', 'Denholm', 'Dunstan', 'Eadwin', 'Egbert', 'Elric', 'Emery', 'Everard', 'Gareth', 'Gilbert', 'Godwin', 'Hamond', 'Hugh', 'Ingram', 'Jory', 'Leofric', 'Merrick', 'Odo', 'Oswin', 'Piers', 'Radulf', 'Rowan', 'Selwyn', 'Tobin', 'Ulric', 'Walden', 'Wystan', 'Aylwin', 'Bede', 'Hal'],
  f: ['Ada', 'Brea', 'Cyra', 'Dara', 'Elin', 'Faye', 'Gwen', 'Hild', 'Isa', 'Jora', 'Kira', 'Lena', 'Mira', 'Nell', 'Orla', 'Pia', 'Rhea', 'Sela', 'Tess', 'Wyn', 'Agnes', 'Aldith', 'Alys', 'Avelina', 'Beatrix', 'Bryony', 'Cecily', 'Eluned', 'Edith', 'Edwina', 'Elfreda', 'Elspeth', 'Emma', 'Gytha', 'Hawise', 'Helga', 'Ida', 'Ingrid', 'Isolde', 'Joan', 'Juliana', 'Leofrun', 'Linnet', 'Mabel', 'Marion', 'Matilda', 'Maud', 'Ottilie', 'Petra', 'Ragna', 'Rosamund', 'Rowena', 'Sigrid', 'Sybil', 'Thora', 'Una', 'Wenna', 'Winifred', 'Aveline', 'Goda'],
  houses: ['Ashdown', 'Barrow', 'Coldwell', 'Dunmere', 'Elmsley', 'Fairwind', 'Greyfell', 'Harrow', 'Ironwood', 'Kestrel', 'Longmeadow', 'Marsh', 'Northcott', 'Oakes', 'Pike', 'Redfern', 'Stoneham', 'Thorne', 'Underhill', 'Wolfe', 'Applegarth', 'Ashford', 'Blackmoor', 'Bramley', 'Briarwood', 'Brookfield', 'Carver', 'Cotter', 'Dale', 'Fenwick', 'Fletcher', 'Foxley', 'Glenholm', 'Hawthorne', 'Hayward', 'Heathcote', 'Holloway', 'Kingsley', 'Lindale', 'Mercer', 'Millward', 'Moorcroft', 'Netherby', 'Penrose', 'Ravensworth', 'Ridley', 'Rushford', 'Sallow', 'Shepherd', 'Southwick', 'Tanner', 'Thatcher', 'Wainwright', 'Westbrook', 'Whitlock', 'Wilder', 'Woodward', 'Yarrow', 'Ashby', 'Fernhill'],
};

/** A people's names, or the band folk's for a people the lists do not know. */
export const namesOfPeople = (people: string | undefined): PeopleNames => PEOPLE_NAMES[people ?? ''] ?? BAND_NAMES;
/** The given names a people gives its men (`'m'`) or women (`'f'`). */
export const givenNames = (people: string | undefined, gender: string | null | undefined): readonly string[] => (gender === 'f' ? namesOfPeople(people).f : namesOfPeople(people).m);
/** The names of a people's houses. */
export const houseNames = (people: string | undefined): readonly string[] => namesOfPeople(people).houses;
/** A name from a list by a number in [0, 1): the same number always gives the same name. */
export const nameAt = (list: readonly string[], roll: number): string => list[Math.min(list.length - 1, Math.max(0, Math.floor(roll * list.length)))];

/** The people a town on the map belongs to: its holder's, or none (the band folk's names) for a town nobody holds. */
export const townPeople = (c: { territories: { owner: number }[]; factions: { civ: string }[] }, tid: number): string | undefined => {
  const o = c.territories[tid]?.owner ?? -1;
  return o >= 0 ? c.factions[o]?.civ : undefined;
};
