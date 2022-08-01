/**
 * Logique métier d'un jeu 4x (explore, expand, exploit, exterminate)
 *
 */

class Player {
    /**
     *
     * @param {String} name
     * @param {String} color
     * @param {String} raceName
     * @param {Planet} homePlanet
     * @param {Star}   homeStar
     */
    constructor(name, color, raceName, homePlanet, homeStar) {
        this.name = name;
        this.color = color;
        this.race = races[raceName];
        this.homePlanet = homePlanet;

        this.science = 0; // points de recherche accumulés sur le tour
        // this.planets = [homePlanet];
        this.ships = [];
        this.yield = {
            agr: this.race.yield.agr,
            ind: this.race.yield.ind,
            sci: this.race.yield.sci,
            $: this.race.yield.$,
        };
        this.fight = {
            attack: 1,
            defense: 1,
        };
        this.ship = {
            speed: 1,
            range: 1,
        };

        /** {Technologie[]} this.technologies */
        this.technologies = []; // technologies maîtrisées

        this.money = 100;

        /** {ResearchProject[]} this.techQueue */
        this.techQueue = [];
        homePlanet.parentStar = homeStar;
        homePlanet.ownerPlayer = this;
        homePlanet.population = 1;
        homePlanet.populationDist.agr = 1;
    }

    turn() {
        // recherche scientifique
        let curResearchProj = this.techQueue.shift();
        if (!curResearchProj) {
            this.science = 0;
        } else {
            let excessScience = curResearchProj.research(this.science);
            this.science = 0;

            // le projet de recherche a abouti → on acquiert la techno et l'excédent de science part dans la recherche
            // suivante
            if (excessScience >= 0) {
                this.technologies.push(curResearchProj.technology);
                if (this.techQueue.length) {
                    this.techQueue[0].research(excessScience);
                } else {
                    this.science = excessScience;
                }
            } else {
                // on remet le projet dans la file d'attente
                this.techQueue.unshift(curResearchProj);
            }
        }

        // évolution des vaisseaux
        for (let i = 0; i < this.ships.length; i++) {
            let s = this.ships[i];
            s.turn();
        }
    }
}

class Technology {
    /**
     *
     * @param {String} name
     * @param {Number} cost
     * @param {function} func
     */
    constructor(name, cost, func) {
        this.cost = cost;
        this.func = func;
    }

    applyToPlayer(player) {
        let func = this.func;
        func(player);
    }
}

class ResearchProject {
    constructor(name) {
        this.technology = technologies[name];
        this.scienceSpent = 0;
    }

    research(science) {
        this.scienceSpent += science;
        return this.scienceSpent - this.technology.cost;
    }
}

class Buildable {
    constructor(name, workCost, type, props = {}) {
        this.workCost = 0;
        this.name = 0;
        this.type = type;
        this.props = props;
    }
}

class Fightable {
    constructor(attack, defense) {
        this.attack = attack;
        this.defense = defense;
    }
}

class ItemBeingBuilt {
    constructor(name) {
        this.buildable = buildables[name];
        this.workSpent = 0;
        this.built = false;
    }

    build(work) {
        this.workSpent += work;
        let excessWork = this.workSpent - this.buildable.workCost;
        if (excessWork >= 0) this.built = true;
        return excessWork;
    }
}

class Ship extends Fightable {
    /**
     *
     * @param {Object} props
     * @param {Number} props.range
     * @param {Number} props.speed
     * @param {Number} props.attack
     * @param {Number} props.defense
     */
    constructor(props) {
        super(props.attack, props.defense);
        this.range = props.range;
        this.speed = props.speed;
    }

    turn() {

    }
}

/**
 *
 * @param {Buildable} buildable
 */
Ship.prototype.from = function (buildable) {
    let ship = new Ship(buildable.props)
    return ship;
}

class Star {
    constructor(name, pos) {
        this.name = name;
        this.pos = {x: 0, y: 0};
        this.planets = [];
    }

    initRandom() {
        this.name = this.starNames.draw();

        let gridStr;
        let gridX, gridY;
        while (gridStr === undefined || this.starsByGrid[gridStr]) {
            gridX = Math.floor(Math.random() * 10);
            gridY = Math.floor(Math.random() * 10);
            gridStr = `${gridX}:${gridY}`;
        }
        this.starsByGrid[gridStr] = this;
        const posX = 5 * gridX + Math.floor(Math.random());
        const posY = 5 * gridY + Math.floor(Math.random());
        this.pos = {x: posX, y: posY};

        const numPlanets = Math.floor(Math.random() * 5);
        for (let i = 0; i < numPlanets; i++) {
            const p = new Planet(this);
            p.initRandom();
            this.planets.push(p);
        }
        return this;
    }
}

class Planet extends Fightable {
    constructor(parentStar) {
        super(0, 0);
        this.parentStar = parentStar;

        // ce que peut produire la planète de base par habitant
        this.yield = {
            agr: 0,
            ind: 0,
            sci: 0,
        };

        // répartition des habitant par secteur de travail: agriculture, industrie, science
        this.populationDist = {
            agr: 0,
            ind: 0,
            sci: 0,
        };

        this.population = 0;
        this.populationMax = 0;
        /** {Player} this.ownerPlayer */
        this.ownerPlayer = undefined;
        this.buildQueue = [];
        this.buildings = [];
        this.shipsInOrbit = [];

        this.populationEvol = 0; // lorsque la variable atteint +10, population++, si -10, population--.
    }

    /**
     * Initialise les propriétés de la planète en fonction de caractéristiques prédéfinies de
     * taille, minéraux, climat et intérêt scientifique
     *
     * @param {Object} types
     * @param {String} types.size
     * @param {String} types.minerals
     * @param {String} types.climate
     * @param {String} types.curiosity
     */
    initFromType(types) {
        Object.keys(planetTypes).forEach((characteristic) => {
            const props = planetTypes[characteristic][types[characteristic]];
            for (const k in props) {
                if (props[k] === Object(props[k])) {
                    for (const l in props[k]) {
                        this[k][l] = props[k][l];
                    }
                } else {
                    this[k] = props[k];
                }
            }
        });
        return this;
    }

    initRandom() {
        let characteristics = {
            'size': randKey(planetTypes.size),
            'minerals': randKey(planetTypes.minerals),
            'climate': randKey(planetTypes.climate),
            'curiosity': randKey(planetTypes.curiosity),
        };
        return this.initFromType(characteristics);
    }

    turn() {
        const balance = {
            ind: 0,
            agr: 0,
            sci: 0,
            $: 0,
        };

        const turnYield = {
            ind: Math.floor(this.yield.ind * this.ownerPlayer.yield.ind * this.ownerPlayer.race.yield.ind),
            agr: Math.floor(this.yield.agr * this.ownerPlayer.yield.agr * this.ownerPlayer.race.yield.agr),
            sci: Math.floor(this.yield.sci * this.ownerPlayer.yield.sci * this.ownerPlayer.race.yield.sci),
            $: Math.floor(this.ownerPlayer.yield.$ * this.ownerPlayer.race.yield.$ * this.population),
        };


        if (!this.ownerPlayer) return;

        // industrie: on construit les objets de la file d'attente ou bien on fait de l'argent
        if (!this.buildQueue.length) {
            balance.$ = turnYield.ind;
        } else {
            // on construit un objet par tour maximum
            balance.ind = this.buildQueue[0].build(turnYield.ind);
            if (balance.ind > 0) {
                // l'objet en haut de la liste est construit: on le retire de la liste
                // et on ajoute son type aux objets de la planète.
                const builtitem = this.buildQueue.shift().buildable;
                if (builtitem.type === 'building') {
                    this.buildings.push(builtitem);
                } else if (builtitem.type === 'ship') {
                    this.shipsInOrbit.push(Ship.from(builtitem));
                }

                if (this.buildQueue.length) {
                    this.buildQueue[0].build(balance.ind);
                    balance.ind = 0;
                } else {
                    balance.$ = balance.ind;
                    balance.ind = 0;
                }
            }
        }

        // agriculture: on nourrit les habitants, l'excédent se transforme en argent, les famines tuent
        balance.agr = turnYield.agr - this.population;
        if (balance.agr > 0) {
            balance.$ = Math.floor(balance.agr / 2);
            balance.agr = 0;
            this.populationEvol += 1 * this.ownerPlayer.race.growth;
            while (this.populationEvol > 10 && this.population < this.populationMax) {
                this.populationEvol -= 10;
                this.population++;
            }
        } else {
            this.populationEvol += balance.agr;
            while (this.populationEvol < -10) {
                this.population--;
                this.populationEvol += 10;
            }
        }

        // science
        balance.sci += turnYield.sci;
        this.ownerPlayer.science += balance.sci;

        // argent: combien on en a produit
        balance.$ += turnYield.$;

        // argent: combien on en a consommé pour l'entretien des bâtiments
        for (let i = 0; i < this.buildings.length; i++) {
            balance.$ -= this.buildings[i].props['maintenanceCost'];
        }

        // l'excédent ou le déficit sont reportés sur le joueur
        this.ownerPlayer.money += balance.$;
    }
}

class Game {
    constructor() {
        this.cache = {};
        this.nTurns = 0;
        const stars = [];
        const planets = [];
        for (let i = 0; i < 50; i++) {
            let s = new Star();
            s.initRandom();
            stars.push(s);
            planets.push(...s.planets);
        }
        this.stars = stars;
        this.planets = planets;

        const createPlayer = (name, color, race) => {
            let star = new Star().initRandom();
            let planet = new Planet(star);
            planet.initFromType(races[race].homePlanetType);
            star.planets.push(planet);
            stars.push(star);
            planets.push(planet);
            return new Player(name, color, race, planet, star);
        };

        const players = [
            createPlayer('Caesar', '#f00', 'humans'),
            createPlayer('Murderator', '#0ea', 'necruans'),
        ];
        players.forEach((p) => {
            p.techQueue.push(new ResearchProject('lab'));
        });
        this.players = players;

        this.mainPlayer = players[0];

    }

    turn() {

        // évolution des planètes
        for (let i = 0; i < this.planets.length; i++) {
            const p = this.planets[i];
            if (!p.ownerPlayer) continue;
            p.turn();
        }

        // évolution du joueur (vaisseaux, recherche…)
        for (let i = 0; i < this.players.length; i++) {
            const p = this.players[i];
            p.turn();
        }
        this.nTurns++;
    }

    renderGalaxyMap() {
        const div = this.cache.div = this.cache.div || document.querySelector('#moony .starboundaries');
        for (let i = 0; i < this.stars.length; i++) {
            const star = this.stars[i];
            const starimg = document.createElement('span');
            starimg.classList.add('starimg');
            starimg.style.left = `${star.pos.x}vw`;
            starimg.style.top = `${star.pos.y}vh`;
            div.appendChild(starimg);

            const starname = document.createElement('span');
            starname.classList.add('starname');
            starname.innerText = star.name;
            starname.style.left = `${star.pos.x - 0.5}vw`;
            starname.style.top = `${star.pos.y + 1}vh`;
            div.appendChild(starname);
        }
    }
}


const buildables = {
    'station': new Buildable('station', 1000, 'building', {maintenanceCost: 1}),
    'autofactory': new Buildable('autofactory', 100, 'building', {maintenanceCost: 1}),
    'colonyship': new Buildable('colonyship', 600, 'ship', {speed: 1, range: 10, attack: 0, defense: 0}),
    'scoutship': new Buildable('scoutship', 2, 'ship', {speed: 1, range: 10, attack: 1, defense: 0}),
};

const technologies = {
    'lab': new Technology('lab', 50, (p) => {
        p.yield++
    }),
    'spacelaser': new Technology('spacelaser', 150, (p) => {
        p.fight.attack += 2;
    }),
    'fastship': new Technology('lab', 200, (p) => {
        p.ship.speed += 2;
    }),
}

const races = {
    'humans': {
        name: 'humans',
        shipAttack: 1,
        shipDefense: 1,
        growth: 1,
        yield: {agr: 1, ind: 1, sci: 1, $: 1},
        homePlanetType: {size: 'medium', minerals: 'medium', climate: 'temperate', curiosity: 'atypical'},
    },
    'necruans': {
        name: 'necruans',
        shipAttack: 1,
        shipDefense: 1,
        growth: 1,
        yield: {agr: 1, ind: 1, sci: 1, $: 1},
        homePlanetType: {size: 'medium', minerals: 'medium', climate: 'temperate', curiosity: 'atypical'},
    },
};


// typical planet characteristics. Combined they make up planets like:
// a mineral-poor, temperate, diverse planet
const planetTypes = {
    'minerals': {
        'rich': {yield: {ind: 4}},
        'medium': {yield: {ind: 4}},
        'poor': {yield: {ind: 4}},
    },
    'climate': {
        'lush': {yield: {agr: 4}},
        'temperate': {yield: {agr: 3}},
        'tundra': {yield: {agr: 1}},
        'barren': {yield: {agr: 0}},
    },

    //
    'curiosity': {
        'uninteresting': {yield: {sci: 1}},
        'atypical': {yield: {sci: 2}},
        'rare': {yield: {sci: 3}},
    },

    'size': {
        'huge': {populationMax: 6},
        'big': {populationMax: 5},
        'medium': {populationMax: 4},
        'small': {populationMax: 3},
        'tiny': {populationMax: 2},
    }
};

// renvoie un élément aléatoire d'un tableau
Array.prototype.pick = function () {
    return this[Math.floor(Math.random() * this.length)];
}

Array.prototype.pickCondition = function (cond) {
    for (let i = 0; i < 100; i++) {
        let candidate = this.pick();
        if (cond(candidate)) return candidate;
    }
    return undefined;
}

// comme "pick" mais retire l'élément choisi du tableau
Array.prototype.draw = function () {
    return this.splice(Math.floor(Math.random() * this.length), 1).pop();
}

const randItem = function (array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Retourne une clé aléatoire de l'objet obj
 * @param obj
 * @returns {string}
 */
const randKey = function (obj) {
    return Object.keys(obj).pick();
}

// from Wikipedia: https://en.wikipedia.org/wiki/List_of_proper_names_of_stars
// extracted using Array.from(TABLEAU.querySelectorAll('tbody  td:nth-child(3)')).map(i => i.innerText)
Star.prototype.starNames = [
    "Absolutno",
    "Acamar",
    "Achernar",
    "Achird",
    "Acrab",
    "Acrux",
    "Acubens",
    "Adhafera",
    "Adhara",
    "Adhil",
    "Ain",
    "Ainalrami",
    "Aladfar",
    "Alamak†",
    "Alasia",
    "Alathfar†",
    "Albaldah",
    "Albali",
    "Albireo",
    "Alchiba",
    "Alcor",
    "Alcyone",
    "Aldebaran",
    "Alderamin",
    "Aldhanab",
    "Aldhibah",
    "Aldulfin",
    "Alfirk",
    "Algedi",
    "Algenib",
    "Algieba",
    "Algol",
    "Algorab",
    "Alhena",
    "Alioth",
    "Aljanah",
    "Alkaid",
    "Al Kalb al Rai†",
    "Alkalurops",
    "Alkaphrah",
    "Alkarab",
    "Alkes",
    "Almaaz",
    "Almach",
    "Al Minliar al Asad†",
    "Alnair",
    "Alnasl",
    "Alnilam",
    "Alnitak",
    "Alniyat",
    "Alphard",
    "Alphecca",
    "Alpheratz",
    "Alpherg",
    "Alrakis",
    "Alrescha",
    "Alruba",
    "Alsafi",
    "Alsciaukat",
    "Alsephina",
    "Alshain",
    "Alshat",
    "Altair",
    "Altais",
    "Alterf",
    "Aludra",
    "Alula Australis",
    "Alula Borealis",
    "Alya",
    "Alzirr",
    "Amadioha",
    "Amansinaya",
    "Anadolu",
    "Ancha",
    "Angetenar",
    "Aniara",
    "Ankaa",
    "Anser",
    "Antares",
    "Arcalís",
    "Arcturus",
    "Arkab Posterior",
    "Arkab Prior",
    "Arneb",
    "Ascella",
    "Asellus Australis",
    "Asellus Borealis",
    "Ashlesha",
    "Asellus Primus†",
    "Asellus Secundus†",
    "Asellus Tertius†",
    "Aspidiske",
    "Asterope, Sterope†",
    "Atakoraka",
    "Athebyne",
    "Atik",
    "Atlas",
    "Atria",
    "Avior",
    "Axólotl",
    "Ayeyarwady",
    "Azelfafage",
    "Azha",
    "Azmidi",
    "Baekdu",
    "Barnard's Star",
    "Baten Kaitos",
    "Beemim",
    "Beid",
    "Belel",
    "Bélénos",
    "Bellatrix",
    "Berehynia",
    "Betelgeuse",
    "Bharani",
    "Bibhā",
    "Biham",
    "Bosona",
    "Botein",
    "Brachium",
    "Bubup",
    "Buna",
    "Bunda",
    "Canopus",
    "Capella",
    "Caph",
    "Castor",
    "Castula",
    "Cebalrai",
    "Ceibo",
    "Celaeno",
    "Cervantes",
    "Chalawan",
    "Chamukuy",
    "Chaophraya",
    "Chara",
    "Chason",
    "Chechia",
    "Chertan",
    "Citadelle",
    "Citalá",
    "Cocibolca",
    "Copernicus",
    "Cor Caroli",
    "Cujam",
    "Cursa",
    "Dabih",
    "Dalim",
    "Deneb",
    "Deneb Algedi",
    "Denebola",
    "Diadem",
    "Dingolay",
    "Diphda",
    "Dìwö",
    "Diya",
    "Dofida",
    "Dombay",
    "Dschubba",
    "Dubhe",
    "Dziban",
    "Ebla",
    "Edasich",
    "Electra",
    "Elgafar",
    "Elkurud",
    "Elnath",
    "Eltanin",
    "Emiw",
    "Enif",
    "Errai",
    "Fafnir",
    "Fang",
    "Fawaris",
    "Felis",
    "Felixvarela",
    "Flegetonte",
    "Fomalhaut",
    "Formosa",
    "Franz",
    "Fulu",
    "Funi",
    "Fumalsamakah",
    "Furud",
    "Fuyue",
    "Gacrux",
    "Gakyid",
    "Garnet Star†",
    "Giausar",
    "Gienah",
    "Ginan",
    "Gloas",
    "Gomeisa",
    "Graffias†",
    "Grumium",
    "Gudja",
    "Gumala",
    "Guniibuu",
    "Hadar",
    "Haedus",
    "Hamal",
    "Hassaleh",
    "Hatysa",
    "Helvetios",
    "Heze",
    "Hoggar",
    "Homam",
    "Horna",
    "Hunahpú",
    "Hunor",
    "Iklil",
    "Illyrian",
    "Imai",
    "Intercrus",
    "Inquill",
    "Intan",
    "Irena",
    "Itonda",
    "Izar",
    "Jabbah",
    "Jishui",
    "Kaffaljidhma",
    "Kakkab†",
    "Kalausi",
    "Kamuy",
    "Kang",
    "Karaka",
    "Kaus Australis",
    "Kaus Borealis",
    "Kaus Media",
    "Kaveh",
    "Kekouan†",
    "Keid",
    "Khambalia",
    "Kitalpha",
    "Kochab",
    "Koeia",
    "Koit",
    "Kornephoros",
    "Kraz",
    "Kuma†",
    "Kurhah",
    "La Superba",
    "Larawag",
    "Lerna",
    "Lesath",
    "Libertas",
    "Lich",
    "Liesma",
    "Lilii Borea",
    "Lionrock",
    "Lucilinburhuc",
    "Lusitânia",
    "Maasym",
    "Macondo",
    "Mago",
    "Mahasim",
    "Mahsati",
    "Maia",
    "Malmok",
    "Marfak†",
    "Marfik",
    "Markab",
    "Markeb",
    "Márohu",
    "Marsic",
    "Matar",
    "Mazaalai",
    "Mebsuta",
    "Megrez",
    "Meissa",
    "Mekbuda",
    "Meleph",
    "Menkalinan",
    "Menkar",
    "Menkent",
    "Menkib",
    "Merak",
    "Merga",
    "Meridiana",
    "Merope",
    "Mesarthim",
    "Miaplacidus",
    "Mimosa",
    "Minchir",
    "Minelauva",
    "Mintaka",
    "Mira",
    "Mirach",
    "Miram",
    "Mirfak",
    "Mirzam",
    "Misam",
    "Mizar",
    "Moldoveanu",
    "Mönch",
    "Montuno",
    "Morava",
    "Moriah",
    "Mothallah",
    "Mouhoun",
    "Mpingo",
    "Muliphein",
    "Muphrid",
    "Muscida",
    "Musica",
    "Muspelheim",
    "Nahn",
    "Naledi",
    "Naos",
    "Nash†",
    "Nashira",
    "Násti",
    "Natasha",
    "Navi†",
    "Nekkar",
    "Nembus",
    "Nenque",
    "Nervia",
    "Nihal",
    "Nikawiy",
    "Nosaxa",
    "Nunki",
    "Nusakan",
    "Nushagak",
    "Nyamien",
    "Ogma",
    "Okab",
    "Paikauhale",
    "Parumleo",
    "Peacock",
    "Petra",
    "Phact",
    "Phecda",
    "Pherkad",
    "Phoenicia",
    "Piautos",
    "Pincoya",
    "Pipoltr",
    "Pipirima",
    "Pleione",
    "Poerava",
    "Polaris",
    "Polaris Australis",
    "Polis",
    "Pollux",
    "Porrima",
    "Praecipua",
    "Prima Hyadum",
    "Procyon",
    "Propus",
    "Proxima Centauri",
    "Ran",
    "Rapeto",
    "Rasalas",
    "Rasalgethi",
    "Rasalhague",
    "Rastaban",
    "Regor†",
    "Regulus",
    "Revati",
    "Rigel",
    "Rigil Kentaurus",
    "Rosalíadecastro",
    "Rotanev",
    "Ruchbah",
    "Rukbat",
    "Sabik",
    "Saclateni",
    "Sadachbia",
    "Sadalbari",
    "Sadalmelik",
    "Sadalsuud",
    "Sadr",
    "Sagarmatha",
    "Saiph",
    "Salm",
    "Sāmaya",
    "Sansuna",
    "Sargas",
    "Sarin",
    "Sarir†",
    "Sceptrum",
    "Scheat",
    "Schedar",
    "Secunda Hyadum",
    "Segin",
    "Seginus",
    "Sham",
    "Shama",
    "Sharjah",
    "Shaula",
    "Sheliak",
    "Sheratan",
    "Sika",
    "Sirius",
    "Situla",
    "Skat",
    "Solaris",
    "Spica",
    "Sterrennacht",
    "Stribor",
    "Sualocin",
    "Subra",
    "Suhail",
    "Sulafat",
    "Syrma",
    "Tabit",
    "Taika",
    "Taiyangshou",
    "Taiyi",
    "Talitha",
    "Tangra",
    "Tania Australis",
    "Tania Borealis",
    "Tapecue",
    "Tarazed",
    "Tarf",
    "Taygeta",
    "Tegmine",
    "Tejat",
    "Terebellum",
    "Tevel",
    "Thabit†",
    "Theemin",
    "Thuban",
    "Tiaki",
    "Tianguan",
    "Tianyi",
    "Timir",
    "Tislit",
    "Titawin",
    "Tojil",
    "Toliman",
    "Tonatiuh",
    "Torcular",
    "Tuiren",
    "Tupã",
    "Tupi",
    "Tureis",
    "Ukdah",
    "Uklun",
    "Unukalhai",
    "Unurgunite",
    "Uruk",
    "Vega",
    "Veritate",
    "Vindemiatrix",
    "Wasat",
    "Wazn",
    "Wezen",
    "Wurren",
    "Xamidimura",
    "Xihe",
    "Xuange",
    "Yed Posterior",
    "Yed Prior",
    "Yildun",
    "Zaniah",
    "Zaurak",
    "Zavijava",
    "Zhang",
    "Zibal",
    "Zosma",
    "Zubenelgenubi",
    "Zubenelhakrabi",
    "Zubeneschamali"
];
Star.prototype.starsByGrid = {};
