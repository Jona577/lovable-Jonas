import React from 'react';
import {
    Target, Rocket, Trophy, Flame, Zap, CheckCircle2,
    Dumbbell, Activity, Heart, Apple, Moon,
    DollarSign, TrendingUp, PiggyBank, Briefcase, Building2,
    Book, GraduationCap, Brain, Globe, Laptop, Code2,
    Plane, Sun, Palette, Music, Gamepad2, Film, Utensils, Home, Leaf,
    Smile, Users, Baby, PawPrint, Clock, Smartphone,
    Coffee, Bike, Medal, Star, Sparkles, Flag, MapPin,
    Camera, Gift, Shield, PenTool, Search, Loader2,
    Waves, Footprints, Beer, Pizza, Car, Bus, ShoppingBag, Hammer
} from 'lucide-react';

export const getGoalIcon = (keyword: string): React.ReactNode => {
    const kw = keyword.toLowerCase().trim();

    const defaultIcon = <Target className="w-full h-full text-blue-500" />;

    if (!kw) return defaultIcon;

    // Mapa massivo de categorias
    const iconMap: Record<string, { icon: React.ReactNode, terms: string[] }> = {
        // === ESPORTES & ATIVIDADES ===
        'fitness': {
            icon: <Dumbbell className="w-full h-full text-orange-500" />,
            terms: ['musculo', 'forte', 'academia', 'gym', 'treino', 'força', 'bodybuilding', 'peso', 'levantar', 'crossfit', 'funcional', 'malhar', 'biceps', 'triceps', 'perna', 'supino', 'agachamento', 'anilhas', 'halter', 'fit', 'fitness', 'maromba']
        },
        'cardio': {
            icon: <Activity className="w-full h-full text-red-500" />,
            terms: ['corrida', 'correr', 'maratona', 'esteira', 'aerobico', 'coracao', 'cardio', 'caminhada', 'andar', 'passos', 'cooper', 'jogging', 'sprint', 'velocidade', 'resistencia']
        },
        'swim': {
            icon: <Waves className="w-full h-full text-blue-500" />,
            terms: ['natacao', 'nadar', 'piscina', 'hidro', 'mar', 'agua', 'mergulho', 'banho', 'club', 'lago', 'rio', 'oceano', 'nado', 'crawl', 'costas', 'peito', 'borboleta', 'touca', 'oculos']
        },
        'walk': {
            icon: <Footprints className="w-full h-full text-orange-400" />,
            terms: ['caminhada', 'andar', 'passos', 'passear', 'trekking', 'trilha', 'passeio', 'calcada', 'parque', 'floresta']
        },
        'bike': {
            icon: <Bike className="w-full h-full text-cyan-500" />,
            terms: ['bicicleta', 'bike', 'pedalar', 'ciclismo', 'ciclista', 'mountain bike', 'estrada', 'rodagem', 'ciclovia', 'capacete', 'pedal']
        },
        'yoga': {
            icon: <Smile className="w-full h-full text-teal-500" />,
            terms: ['meditacao', 'yoga', 'mindfulness', 'paz', 'calma', 'respiração', 'pilates', 'bem-estar', 'zen', 'equilibrio', 'alongamento', 'flexibilidade', 'namaste', 'lotus']
        },
        'soccer': {
            icon: <Trophy className="w-full h-full text-green-600" />,
            terms: ['futebol', 'bola', 'gol', 'chuteira', 'campo', 'estadio', 'time', 'futsal', 'pelada', 'jogo', 'partida', 'campeonato']
        },

        // === COMIDA & BEBIDA ===
        'diet': {
            icon: <Apple className="w-full h-full text-green-500" />,
            terms: ['dieta', 'alimentacao', 'salada', 'vegetais', 'nutricao', 'fruta', 'vitaminas', 'vegan', 'detox', 'saudavel', 'comer', 'refeicao', 'almoco', 'jantar', 'cafe da manha', 'legumes', 'verduras']
        },
        'water': {
            icon: <div className="text-blue-500 text-3xl font-bold">💧</div>,
            terms: ['agua', 'beber', 'hidratar', 'liquido', 'garrafa', 'sede', 'h2o', 'copo', 'litro']
        },
        'coffee': {
            icon: <Coffee className="w-full h-full text-amber-700" />,
            terms: ['cafe', 'café', 'xicara', 'xícara', 'cha', 'bebida', 'tarde', 'expresso', 'cappuccino', 'starbucks', 'cafeina', 'pingado', 'leite']
        },
        'beer': {
            icon: <Beer className="w-full h-full text-amber-500" />,
            terms: ['cerveja', 'chope', 'drink', 'bar', 'happy hour', 'alcool', 'vinho', 'festa', 'balada']
        },
        'pizza': {
            icon: <Pizza className="w-full h-full text-orange-500" />,
            terms: ['pizza', 'lanche', 'fast food', 'hamburguer', 'dog', 'comida', 'delivery', 'ifood']
        },
        'cook': {
            icon: <Utensils className="w-full h-full text-orange-600" />,
            terms: ['cozinhar', 'culinaria', 'gastronomia', 'receita', 'chef', 'comida', 'almoco', 'jantar', 'prato', 'restaurante', 'fome', 'gourmet', 'fogao', 'ingrediente']
        },

        // === VIDA & HOBBIES ===
        'sleep': {
            icon: <Moon className="w-full h-full text-indigo-500" />,
            terms: ['sono', 'dormir', 'descanso', 'soneca', 'noite', 'cama', 'travesseiro', 'acordar', 'cedo', 'cochilo', 'sonhar']
        },
        'travel': {
            icon: <Plane className="w-full h-full text-sky-500" />,
            terms: ['viagem', 'viajar', 'turismo', 'passeio', 'voo', 'aviao', 'ferias', 'aeroporto', 'mala', 'passaporte', 'mundo', 'estrangeiro']
        },
        'beach': {
            icon: <Sun className="w-full h-full text-yellow-500" />,
            terms: ['praia', 'mar', 'sol', 'verao', 'calor', 'areia', 'bronze', 'piscina', 'litoral']
        },
        'art': {
            icon: <Palette className="w-full h-full text-rose-500" />,
            terms: ['arte', 'criatividade', 'pintura', 'desenho', 'design', 'ilustracao', 'cor', 'tinta', 'pincel', 'museu', 'exposicao', 'quadro', 'artista']
        },
        'music': {
            icon: <Music className="w-full h-full text-violet-500" />,
            terms: ['musica', 'som', 'canca', 'ouvir', 'violao', 'guitarra', 'piano', 'banda', 'show', 'playlist', 'spotify', 'fone', 'radio', 'cantor']
        },
        'game': {
            icon: <Gamepad2 className="w-full h-full text-purple-600" />,
            terms: ['game', 'jogo', 'videogame', 'playstation', 'xbox', 'nintendo', 'jogar', 'gamer', 'lol', 'fortnite', 'minecraft', 'steam', 'pc', 'console']
        },
        'movie': {
            icon: <Film className="w-full h-full text-slate-700" />,
            terms: ['filme', 'cinema', 'serie', 'netflix', 'assistir', 'video', 'pipoca', 'maratona', 'hollywood', 'ator', 'tela', 'tv']
        },
        'camera': {
            icon: <Camera className="w-full h-full text-slate-600" />,
            terms: ['foto', 'fotografia', 'camera', 'imagem', 'selfie', 'retrato', 'album', 'fotografo']
        },
        'plant': {
            icon: <Leaf className="w-full h-full text-green-600" />,
            terms: ['plantas', 'jardim', 'natureza', 'horta', 'cultivar', 'flor', 'arvore', 'verde', 'biologia', 'ecologia', 'sustentavel', 'regar']
        },

        // === ESTUDO & TRABALHO ===
        'study': {
            icon: <Book className="w-full h-full text-blue-500" />,
            terms: ['estudo', 'livros', 'biblioteca', 'saber', 'ler', 'leitura', 'capitulo', 'artigo', 'revista', 'pagina', 'texto', 'estudar', 'aprender']
        },
        'grad': {
            icon: <GraduationCap className="w-full h-full text-slate-800" />,
            terms: ['faculdade', 'universidade', 'curso', 'graduacao', 'pos', 'mestrado', 'doutorado', 'diploma', 'formar', 'tcc', 'aula', 'professor', 'prova', 'escola']
        },
        'brain': {
            icon: <Brain className="w-full h-full text-pink-400" />,
            terms: ['aprendizado', 'cerebro', 'inteligencia', 'memoria', 'foco', 'raciocinio', 'mente', 'pensar', 'ideia', 'logica', 'cognitivo']
        },
        'lang': {
            icon: <Globe className="w-full h-full text-blue-400" />,
            terms: ['idioma', 'lingua', 'ingles', 'espanhol', 'frances', 'intercambio', 'mundo', 'viagem', 'cultura', 'fluencia', 'vocabulario', 'traducao']
        },
        'code': {
            icon: <Code2 className="w-full h-full text-emerald-500" />,
            terms: ['programacao', 'codigo', 'codar', 'desenvolvimento', 'dev', 'software', 'ti', 'tech', 'computador', 'python', 'javascript', 'react', 'web', 'app', 'bug', 'sistema']
        },
        'work': {
            icon: <Briefcase className="w-full h-full text-amber-600" />,
            terms: ['trabalho', 'emprego', 'job', 'escritorio', 'business', 'profissional', 'vaga', 'entrevista', 'curriculo', 'linkedin', 'projeto', 'chefe', 'reuniao']
        },
        'career': {
            icon: <Rocket className="w-full h-full text-purple-600" />,
            terms: ['carreira', 'promocao', 'startup', 'lancamento', 'foguete', 'crescer', 'liderança', 'gestao', 'manager', 'ceo', 'sucesso', 'meta']
        },
        'money': {
            icon: <DollarSign className="w-full h-full text-green-600" />,
            terms: ['dinheiro', 'financas', 'riqueza', 'lucro', 'salario', 'pagamento', 'ganhar', 'caixa', 'dolar', 'real', 'banco', 'conta', 'extrato', 'fatura', 'boleto']
        },
        'invest': {
            icon: <TrendingUp className="w-full h-full text-blue-600" />,
            terms: ['investimento', 'bolsa', 'ações', 'fundo', 'rendimento', 'crescimento', 'grafico', 'bitcoin', 'cripto', 'cdb', 'tesouro', 'lucrar']
        },
        'save': {
            icon: <PiggyBank className="w-full h-full text-pink-500" />,
            terms: ['economia', 'poupar', 'guardar', 'custo', 'gasto', 'orçamento', 'cofre', 'reserva', 'emergencia', 'poupanca']
        },

        // === CASA & FAMÍLIA ===
        'home': {
            icon: <Home className="w-full h-full text-stone-600" />,
            terms: ['casa', 'lar', 'moradia', 'reforma', 'construcao', 'decoracao', 'apartamento', 'quarto', 'sala', 'cozinha', 'banheiro', 'limpeza', 'faxina', 'aluguel', 'imovel']
        },
        'family': {
            icon: <Users className="w-full h-full text-blue-400" />,
            terms: ['familia', 'filhos', 'pais', 'parentes', 'uniao', 'amigos', 'social', 'mae', 'pai', 'irmao', 'irma', 'vovo', 'tio', 'tia', 'primo']
        },
        'love': {
            icon: <Heart className="w-full h-full text-red-500" />,
            terms: ['amor', 'coracao', 'paixao', 'namoro', 'casamento', 'relacionamento', 'crush', 'te amo', 'carinho', 'noivado', 'encontro']
        },
        'baby': {
            icon: <Baby className="w-full h-full text-pink-300" />,
            terms: ['bebe', 'filho', 'filha', 'gravidez', 'maternidade', 'crianca', 'infancia', 'brinquedo', 'fralda', 'nene', 'parto']
        },
        'pet': {
            icon: <PawPrint className="w-full h-full text-orange-400" />,
            terms: ['pet', 'cachorro', 'cao', 'dog', 'animal', 'gato', 'bicho', 'veterinario', 'racao', 'passear', 'adotar']
        },
        'gift': {
            icon: <Gift className="w-full h-full text-pink-500" />,
            terms: ['presente', 'doacao', 'aniversario', 'natal', 'surpresa', 'dar', 'receber', 'comemoracao']
        },

        // === OBJETOS & DIVERSOS ===
        'car': {
            icon: <Car className="w-full h-full text-red-600" />,
            terms: ['carro', 'dirigir', 'transito', 'veiculo', 'automovel', 'motorista', 'uber', 'gasolina', 'estrada', 'garagem']
        },
        'bus': {
            icon: <Bus className="w-full h-full text-yellow-600" />,
            terms: ['onibus', 'transporte', 'coletivo', 'rodoviaria', 'ponto']
        },
        'phone': {
            icon: <Smartphone className="w-full h-full text-slate-700" />,
            terms: ['celular', 'telefone', 'ligar', 'mensagem', 'whatsapp', 'app', 'iphone', 'android', 'rede social', 'instagram', 'tiktok']
        },
        'computer': {
            icon: <Laptop className="w-full h-full text-slate-500" />,
            terms: ['computador', 'notebook', 'pc', 'tela', 'teclado', 'mouse', 'internet', 'wifi']
        },
        'shopping': {
            icon: <ShoppingBag className="w-full h-full text-rose-500" />,
            terms: ['compras', 'loja', 'mercado', 'shopping', 'comprar', 'gastar', 'produto', 'sacola', 'promoção']
        },
        'time': {
            icon: <Clock className="w-full h-full text-slate-500" />,
            terms: ['tempo', 'horario', 'acordar', 'relogio', 'alarme', 'hora', 'minuto', 'segundo', 'cronometro', 'prazo', 'atrasado', 'pontual']
        },
        'tools': {
            icon: <Hammer className="w-full h-full text-stone-500" />,
            terms: ['ferramenta', 'conserto', 'reparar', 'arrumar', 'obra', 'martelo', 'chave', 'montar']
        },
        'god': {
            icon: <Sparkles className="w-full h-full text-yellow-400" />,
            terms: ['deus', 'orar', 'reza', 'igreja', 'biblia', 'culto', 'missa', 'fe', 'espiritual', 'bencao', 'anjos']
        },
        'goal': {
            icon: <Target className="w-full h-full text-red-600" />,
            terms: ['meta', 'objetivo', 'alvo', 'conquista', 'focar', 'alcancar', 'chegar', 'proposito']
        },
        'check': {
            icon: <CheckCircle2 className="w-full h-full text-green-500" />,
            terms: ['concluir', 'terminar', 'fazer', 'feito', 'check', 'lista', 'tarefa', 'ok', 'pronto', 'completo']
        },
        'fire': {
            icon: <Flame className="w-full h-full text-orange-500" />,
            terms: ['fogo', 'incendio', 'quente', 'brasa', 'chama', 'calor', 'queimar', 'ardente']
        },
        'award': {
            icon: <Trophy className="w-full h-full text-yellow-500" />,
            terms: ['trofeu', 'vencer', 'ganhar', 'premio', 'campeao', 'sucesso', 'vitoria', 'primeiro lugar', 'podium', 'medalha']
        },
        'star': {
            icon: <Star className="w-full h-full text-amber-400" />,
            terms: ['estrela', 'brilho', 'fama', 'destaque', 'top', 'vip', 'celebridade']
        },
        'search': {
            icon: <Search className="w-full h-full text-slate-400" />,
            terms: ['buscar', 'procurar', 'pesquisar', 'encontrar', 'google', 'descobrir']
        },
        'location': {
            icon: <MapPin className="w-full h-full text-red-500" />,
            terms: ['local', 'lugar', 'mapa', 'gps', 'endereco', 'onde', 'aqui', 'cidade', 'estado', 'pais']
        },
        'productivity': {
            icon: <Zap className="w-full h-full text-yellow-400" />,
            terms: ['produtividade', 'rapidez', 'eficiencia', 'energia', 'flash', 'agilidade', 'performance', 'eletrico']
        }
    };

    const normalizedKw = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 1. Busca exata ou proxima
    for (const item of Object.values(iconMap)) {
        if (item.terms.some(term => term === normalizedKw || normalizedKw.startsWith(term) || term.startsWith(normalizedKw))) {
            return item.icon;
        }
    }

    // 2. Busca por inclusão genérica
    for (const item of Object.values(iconMap)) {
        if (item.terms.some(term => normalizedKw.includes(term) || term.includes(normalizedKw))) {
            return item.icon;
        }
    }

    return defaultIcon;
};
