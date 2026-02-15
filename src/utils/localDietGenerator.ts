/**
 * LOCAL DIET GENERATOR
 * Generates a complete weekly diet plan based on user profile.
 * No external API required — everything runs locally.
 */

interface NutritionProfile {
    age: string;
    height: string;
    weight: string;
    gender: 'male' | 'female' | null;
    objective: string;
    activityLevel: string;
    weeklyTrainings: number;
    trainingIntensity: string;
    desiredWeight: string;
    realisticDeadline: string;
    hasRestriction: boolean;
    restrictions: {
        vegetarian: boolean;
        intolerant: boolean;
        intoleranceDesc: string;
        allergies: boolean;
        allergiesDesc: string;
        dislikedFoods: boolean;
        dislikedFoodsDesc: string;
    };
    monthlyBudget: string;
    culinaryPreference: string;
    mealsPerDay: string;
}

interface MealAlternative {
    name: string;
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    prepTime: string;
    ingredients: string[];
    estimatedCost: number;
    preparation: string;
    micros: Record<string, string>;
    tags?: string[];
}

interface Meal {
    meal: string;
    time: string;
    alternatives: MealAlternative[];
}

interface ShoppingItem {
    item: string;
    quantity: string;
    estimatedPrice: number;
    category: string;
    cheaperAlternative?: string;
}

interface DietData {
    weeklyDiet: { [day: string]: Meal[] };
    weeklyEstimatedCost: number;
    monthlyEstimatedCost: number;
    dailyCalories: number;
    macroSplit: { protein: number; carbs: number; fat: number };
    shoppingList: ShoppingItem[];
    tips: string[];
}

// ========== CALORIE CALCULATOR ==========

function calculateBMR(weight: number, height: number, age: number, gender: string): number {
    if (gender === 'female') {
        return 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
    }
    return 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
}

function getActivityMultiplier(activityLevel: string, weeklyTrainings: number): number {
    const base: Record<string, number> = {
        'sedentario': 1.2, 'sedentário': 1.2, 'sedentary': 1.2,
        'leve': 1.375, 'light': 1.375, 'levemente ativo': 1.375,
        'moderado': 1.55, 'moderate': 1.55, 'moderadamente ativo': 1.55,
        'ativo': 1.725, 'active': 1.725, 'muito ativo': 1.725,
        'super ativo': 1.9, 'very active': 1.9, 'extremamente ativo': 1.9,
    };
    const level = activityLevel?.toLowerCase() || 'moderado';
    let mult = base[level] || 1.55;
    if (weeklyTrainings >= 5) mult += 0.1;
    return mult;
}

function calculateDailyCalories(profile: NutritionProfile): number {
    const weight = parseFloat(profile.weight) || 70;
    const height = parseFloat(profile.height) || 170;
    const age = parseInt(profile.age) || 25;
    const gender = profile.gender || 'male';

    const bmr = calculateBMR(weight, height, age, gender);
    const tdee = bmr * getActivityMultiplier(profile.activityLevel, profile.weeklyTrainings);

    const objective = (profile.objective || '').toLowerCase();
    if (objective.includes('emagrec') || objective.includes('perder') || objective.includes('secar') || objective.includes('definir') || objective.includes('cutting')) {
        return Math.round(tdee * 0.80); // 20% deficit
    }
    if (objective.includes('ganhar') || objective.includes('massa') || objective.includes('hipertrofia') || objective.includes('bulk')) {
        return Math.round(tdee * 1.15); // 15% surplus
    }
    return Math.round(tdee); // maintenance
}

function calculateMacros(calories: number, objective: string): { protein: number; carbs: number; fat: number } {
    const obj = (objective || '').toLowerCase();
    if (obj.includes('emagrec') || obj.includes('perder') || obj.includes('secar') || obj.includes('definir')) {
        return {
            protein: Math.round((calories * 0.35) / 4),
            carbs: Math.round((calories * 0.35) / 4),
            fat: Math.round((calories * 0.30) / 9),
        };
    }
    if (obj.includes('ganhar') || obj.includes('massa') || obj.includes('hipertrofia')) {
        return {
            protein: Math.round((calories * 0.30) / 4),
            carbs: Math.round((calories * 0.45) / 4),
            fat: Math.round((calories * 0.25) / 9),
        };
    }
    return {
        protein: Math.round((calories * 0.30) / 4),
        carbs: Math.round((calories * 0.40) / 4),
        fat: Math.round((calories * 0.30) / 9),
    };
}

// ========== MEAL DATABASE ==========

const MEAL_DATABASE: Record<string, MealAlternative[]> = {
    cafe_da_manha: [
        {
            name: 'Omelete de Claras com Aveia',
            description: 'Omelete proteico feito com claras de ovo e aveia, perfeito para começar o dia com energia.',
            calories: 320,
            protein: 28,
            carbs: 30,
            fat: 8,
            prepTime: '15 min',
            ingredients: ['4 claras de ovo', '1 ovo inteiro', '3 colheres de aveia em flocos', '1 tomate picado', 'Sal e orégano a gosto', 'Azeite (spray)'],
            estimatedCost: 4.50,
            preparation: `1. Separe as claras dos ovos e bata levemente com um garfo até ficar homogêneo.
2. Adicione a aveia em flocos e misture bem, deixe descansar por 2 minutos para a aveia absorver.
3. Aqueça uma frigideira antiaderente em fogo médio com um spray de azeite.
4. Despeje a mistura na frigideira e espalhe uniformemente.
5. Adicione o tomate picado sobre a superfície.
6. Quando as bordas começarem a firmar (cerca de 3 minutos), dobre ao meio.
7. Cozinhe por mais 2 minutos de cada lado até dourar levemente.
8. Tempere com sal e orégano a gosto.
9. Sirva imediatamente acompanhado de uma fatia de pão integral se desejar.`,
            micros: { 'Ferro': '2.1mg', 'Vit. B12': '1.2mcg', 'Cálcio': '45mg' },
            tags: ['proteico', 'low-fat'],
        },
        {
            name: 'Tapioca com Frango e Queijo',
            description: 'Tapioca recheada com frango desfiado e queijo minas, saborosa e nutritiva.',
            calories: 350,
            protein: 25,
            carbs: 38,
            fat: 10,
            prepTime: '12 min',
            ingredients: ['3 colheres de goma de tapioca', '80g de frango desfiado', '1 fatia de queijo minas', 'Temperos a gosto'],
            estimatedCost: 5.00,
            preparation: `1. Peneire a goma de tapioca para remover grumos.
2. Aqueça uma frigideira antiaderente em fogo médio (sem óleo).
3. Espalhe a goma peneirada na frigideira formando um disco fino e uniforme.
4. Quando a goma começar a grudar e formar uma massa coesa (cerca de 1-2 minutos), vire cuidadosamente.
5. Adicione o frango desfiado temperado no centro da tapioca.
6. Coloque a fatia de queijo minas por cima do frango.
7. Dobre a tapioca ao meio e pressione levemente.
8. Deixe por mais 1 minuto para o queijo derreter.
9. Sirva quente.`,
            micros: { 'Ferro': '1.5mg', 'Vit. A': '15mcg', 'Cálcio': '120mg' },
            tags: ['sem-glúten'],
        },
        {
            name: 'Mingau de Aveia com Banana e Canela',
            description: 'Mingau cremoso de aveia com banana, mel e canela para um café da manhã reconfortante.',
            calories: 380,
            protein: 14,
            carbs: 58,
            fat: 10,
            prepTime: '10 min',
            ingredients: ['5 colheres de aveia em flocos', '200ml de leite desnatado', '1 banana madura', '1 colher de mel', 'Canela em pó a gosto', '1 colher de castanha do Pará triturada'],
            estimatedCost: 3.80,
            preparation: `1. Em uma panela pequena, coloque o leite desnatado e aqueça em fogo baixo.
2. Quando começar a esquentar, adicione a aveia em flocos e mexa constantemente.
3. Cozinhe por 5-7 minutos mexendo sempre até engrossar e ficar cremoso.
4. Enquanto o mingau cozinha, corte a banana em rodelas finas.
5. Quando o mingau estiver na consistência desejada, desligue o fogo.
6. Transfira para uma tigela e adicione as rodelas de banana por cima.
7. Regue com o mel e polvilhe canela generosamente.
8. Finalize com a castanha do Pará triturada para crocância.
9. Sirva morno.`,
            micros: { 'Ferro': '3.2mg', 'Vit. B6': '0.5mg', 'Magnésio': '68mg' },
            tags: ['vegetariano', 'comfort-food'],
        },
        {
            name: 'Pão Integral com Pasta de Amendoim e Frutas',
            description: 'Pão integral com pasta de amendoim natural, banana e uma pitada de chia.',
            calories: 340,
            protein: 14,
            carbs: 42,
            fat: 14,
            prepTime: '5 min',
            ingredients: ['2 fatias de pão integral', '2 colheres de pasta de amendoim natural', '1 banana pequena', '1 colher de chia', 'Mel a gosto'],
            estimatedCost: 4.20,
            preparation: `1. Torre levemente as fatias de pão integral na torradeira ou frigideira.
2. Espalhe uma colher generosa de pasta de amendoim em cada fatia de pão.
3. Corte a banana em rodelas finas e distribua sobre a pasta de amendoim.
4. Polvilhe a chia sobre as frutas.
5. Se desejar, regue com um fio de mel.
6. Sirva imediatamente para manter a crocância do pão.`,
            micros: { 'Ferro': '2.0mg', 'Vit. E': '4.5mg', 'Magnésio': '55mg' },
            tags: ['vegetariano', 'rápido'],
        },
    ],
    lanche_manha: [
        {
            name: 'Iogurte Natural com Granola e Mel',
            description: 'Iogurte natural desnatado com granola crocante e mel puro.',
            calories: 200,
            protein: 12,
            carbs: 28,
            fat: 5,
            prepTime: '3 min',
            ingredients: ['1 pote de iogurte natural desnatado (170g)', '3 colheres de granola sem açúcar', '1 colher de mel puro'],
            estimatedCost: 3.50,
            preparation: `1. Coloque o iogurte natural em uma tigela ou copo largo.
2. Adicione a granola sem açúcar por cima do iogurte, formando uma camada uniforme.
3. Regue com o mel puro de abelha.
4. Para melhor experiência, não misture tudo de uma vez — coma com a colher pegando um pouco de cada camada.
5. Para uma versão mais elaborada, adicione morangos cortados ou blueberries.
6. Consuma imediatamente para a granola manter a crocância.`,
            micros: { 'Cálcio': '200mg', 'Vit. D': '2mcg', 'Potássio': '280mg' },
            tags: ['vegetariano', 'rápido'],
        },
        {
            name: 'Mix de Castanhas e Frutas Secas',
            description: 'Combinação energética de castanhas, nozes e frutas secas para saciar entre refeições.',
            calories: 180,
            protein: 6,
            carbs: 18,
            fat: 12,
            prepTime: '1 min',
            ingredients: ['3 castanhas do Pará', '5 castanhas de caju', '2 nozes', '1 colher de uva passa', '3 damascos secos'],
            estimatedCost: 4.00,
            preparation: `1. Separe todas as castanhas e frutas secas em um potinho ou saco plástico reutilizável.
2. Pode preparar porções individuais para a semana toda de uma vez.
3. Armazene em local seco e fresco, longe da luz direta.
4. Consuma devagar, mastigando bem cada castanha para melhor absorção dos nutrientes.
5. Dica: as castanhas do Pará são ricas em selênio — 3 por dia já atingem a recomendação diária.`,
            micros: { 'Selênio': '290mcg', 'Vit. E': '3.8mg', 'Zinco': '2.1mg' },
            tags: ['vegetariano', 'snack', 'sem-preparo'],
        },
        {
            name: 'Banana com Canela e Aveia',
            description: 'Banana amassada com canela e aveia — simples, rápido e energético.',
            calories: 190,
            protein: 5,
            carbs: 35,
            fat: 3,
            prepTime: '3 min',
            ingredients: ['1 banana grande', '2 colheres de aveia em flocos finos', 'Canela a gosto'],
            estimatedCost: 1.50,
            preparation: `1. Descasque a banana e coloque em um prato fundo.
2. Amasse bem com um garfo até formar um purê.
3. Adicione a aveia em flocos finos e misture até incorporar.
4. Polvilhe canela generosamente por cima.
5. Pode ser consumido frio ou aquecido no microondas por 30 segundos.
6. Excelente opção pré-treino consumida 30 minutos antes do exercício.`,
            micros: { 'Potássio': '422mg', 'Vit. B6': '0.4mg', 'Manganês': '1.2mg' },
            tags: ['vegetariano', 'econômico', 'pré-treino'],
        },
    ],
    almoco: [
        {
            name: 'Frango Grelhado com Arroz Integral e Brócolis',
            description: 'Clássico prato brasileiro fitness com frango temperado, arroz integral e brócolis no vapor.',
            calories: 520,
            protein: 42,
            carbs: 50,
            fat: 12,
            prepTime: '35 min',
            ingredients: ['150g de peito de frango', '4 colheres de arroz integral cozido', '1 xícara de brócolis', '1 fio de azeite', 'Alho, sal, pimenta e limão'],
            estimatedCost: 8.50,
            preparation: `1. Tempere o peito de frango com alho amassado, sal, pimenta-do-reino e suco de meio limão. Deixe marinar por pelo menos 15 minutos (idealmente 30 minutos na geladeira).
2. Cozinhe o arroz integral: lave os grãos, refogue com alho e um fio de azeite, adicione água na proporção 1:2,5 e cozinhe em fogo baixo com a panela tampada por 25-30 minutos.
3. Enquanto o arroz cozinha, lave o brócolis e separe em floretes pequenos.
4. Aqueça uma grelha ou frigideira antiaderente em fogo médio-alto.
5. Grelhe o frango por 5-6 minutos de cada lado, sem mexer muito para criar marcas bonitas na carne.
6. Verifique se o frango está cozido por dentro (sem rosa no centro). A temperatura interna deve ser 74°C.
7. Cozinhe o brócolis no vapor por 4-5 minutos até ficar al dente (verde vibrante e levemente crocante).
8. Monte o prato: arroz integral na base, frango fatiado ao lado e brócolis no vapor.
9. Finalize com um fio de azeite extra virgem e uma pitada de sal.`,
            micros: { 'Ferro': '3.5mg', 'Vit. C': '89mg', 'Cálcio': '62mg' },
            tags: ['proteico', 'clássico'],
        },
        {
            name: 'Carne Moída com Purê de Batata Doce e Salada',
            description: 'Carne moída magra temperada com purê de batata doce e salada verde fresca.',
            calories: 480,
            protein: 35,
            carbs: 48,
            fat: 14,
            prepTime: '40 min',
            ingredients: ['120g de carne moída magra (patinho)', '1 batata doce média', '2 xícaras de salada verde (alface, rúcula)', '1 tomate', '1 cenoura ralada', 'Alho, cebola, sal e pimenta'],
            estimatedCost: 9.00,
            preparation: `1. Lave e descasque a batata doce, corte em cubos de 2cm.
2. Cozinhe a batata doce em água fervente com uma pitada de sal por 15-20 minutos até ficar bem macia.
3. Enquanto a batata cozinha, aqueça uma frigideira em fogo médio com um fio de azeite.
4. Refogue a cebola picada até dourar, depois adicione o alho amassado.
5. Adicione a carne moída e quebre bem com uma colher de pau, cozinhando até dourar completamente (8-10 minutos).
6. Tempere com sal, pimenta-do-reino e, se desejar, um pouco de molho de tomate natural.
7. Escorra a batata doce e amasse com um garfo ou espremedor. Adicione um fio de azeite e uma pitada de sal.
8. Lave e seque as folhas verdes. Corte o tomate em rodelas e rale a cenoura.
9. Monte o prato: purê de batata doce de um lado, carne moída ao lado, e a salada com tomate e cenoura.
10. Tempere a salada com azeite e limão na hora de servir.`,
            micros: { 'Ferro': '4.2mg', 'Vit. A': '835mcg', 'Zinco': '5.1mg' },
            tags: ['proteico', 'reconfortante'],
        },
        {
            name: 'Filé de Tilápia com Arroz e Legumes Salteados',
            description: 'Filé de tilápia grelhado acompanhado de arroz branco e legumes salteados no azeite.',
            calories: 450,
            protein: 38,
            carbs: 45,
            fat: 10,
            prepTime: '30 min',
            ingredients: ['150g de filé de tilápia', '4 colheres de arroz branco', '1 abobrinha pequena', '1 cenoura', '1/2 pimentão', 'Azeite, limão, alho e sal'],
            estimatedCost: 10.00,
            preparation: `1. Tempere o filé de tilápia com suco de limão, alho amassado e sal. Reserve por 10 minutos.
2. Cozinhe o arroz branco da maneira tradicional: lave os grãos, refogue com alho e óleo, adicione água (proporção 1:2) e cozinhe em fogo baixo tampado por 15-18 minutos.
3. Corte a abobrinha em meias-luas, a cenoura em palitos finos e o pimentão em tiras.
4. Aqueça uma frigideira grande em fogo alto com um fio de azeite.
5. Saltei os legumes rapidamente (3-4 minutos), movimentando a frigideira. Eles devem ficar cozidos mas ainda crocantes.
6. Tempere os legumes com sal e reserve.
7. Na mesma frigideira, em fogo médio, grelhe o filé de tilápia por 3-4 minutos de cada lado até dourar e ficar opaco no centro.
8. Monte o prato com arroz, peixe e legumes salteados.
9. Finalize com um fio de azeite e rodelas de limão para servir.`,
            micros: { 'Ferro': '1.8mg', 'Vit. D': '3.1mcg', 'Ômega 3': '200mg' },
            tags: ['low-fat', 'peixe'],
        },
        {
            name: 'Feijoada Light',
            description: 'Versão saudável da feijoada com carnes magras, feijão preto e couve refogada.',
            calories: 500,
            protein: 35,
            carbs: 55,
            fat: 14,
            prepTime: '50 min',
            ingredients: ['100g de lombo suíno magro', '50g de peito de frango defumado', '1 concha de feijão preto', '3 colheres de arroz branco', '1 xícara de couve refogada', '1 laranja'],
            estimatedCost: 9.50,
            preparation: `1. Corte o lombo suíno em cubos pequenos e o peito de frango defumado em fatias.
2. Em uma panela de pressão, refogue alho e cebola em um fio de azeite até dourar.
3. Adicione as carnes e sele por 3-4 minutos até dourar os lados.
4. Acrescente o feijão preto já cozido (ou de lata, lavado e escorrido) e 1 xícara de água.
5. Adicione folha de louro, pimenta-do-reino e sal a gosto.
6. Tampe a panela de pressão e cozinhe por 15 minutos após pegar pressão.
7. Enquanto isso, lave a couve, remova o talo e corte em tiras finas.
8. Refogue a couve em alho com um fio de azeite por 3 minutos em fogo alto.
9. Cozinhe o arroz branco normalmente.
10. Monte o prato: arroz, feijoada, couve refogada e laranja cortada em rodelas ao lado.
11. A laranja ajuda na absorção do ferro do feijão — coma junto!`,
            micros: { 'Ferro': '6.5mg', 'Vit. C': '70mg', 'Folato': '180mcg' },
            tags: ['brasileiro', 'reconfortante'],
        },
    ],
    lanche_tarde: [
        {
            name: 'Sanduíche Natural de Frango',
            description: 'Sanduíche natural leve com frango desfiado, cenoura ralada e requeijão light.',
            calories: 250,
            protein: 20,
            carbs: 25,
            fat: 8,
            prepTime: '8 min',
            ingredients: ['2 fatias de pão integral', '80g de frango desfiado', '1 cenoura ralada', '1 colher de requeijão light', 'Folhas de alface'],
            estimatedCost: 4.50,
            preparation: `1. Se o frango não estiver pronto, cozinhe um peito de frango em água com sal e louro por 20 minutos, depois desfie com garfo.
2. Em uma tigela, misture o frango desfiado com o requeijão light e a cenoura ralada.
3. Tempere com sal e pimenta a gosto. Pode adicionar uma pitada de curry para sabor extra.
4. Torre levemente as fatias de pão integral.
5. Monte o sanduíche: coloque folhas de alface na base, adicione o recheio de frango e feche.
6. Corte na diagonal para facilitar o consumo.
7. Dica: prepare o recheio de frango para a semana toda e mantenha na geladeira em pote fechado por até 3 dias.`,
            micros: { 'Ferro': '1.8mg', 'Vit. A': '420mcg', 'Fibra': '3.5g' },
            tags: ['proteico', 'prático'],
        },
        {
            name: 'Vitamina de Banana com Whey',
            description: 'Vitamina proteica de banana com whey protein e leite desnatado, ideal para pós-treino.',
            calories: 280,
            protein: 28,
            carbs: 30,
            fat: 5,
            prepTime: '5 min',
            ingredients: ['1 banana congelada', '1 scoop de whey protein (baunilha ou chocolate)', '200ml de leite desnatado', '1 colher de aveia', 'Gelo a gosto'],
            estimatedCost: 5.50,
            preparation: `1. Descasque a banana e congele em rodelas na noite anterior (banana congelada dá cremosidade).
2. No liquidificador, adicione o leite desnatado gelado, a banana congelada e o whey protein.
3. Acrescente a aveia em flocos e o gelo.
4. Bata por 30-40 segundos até ficar completamente homogêneo e cremoso.
5. Se preferir mais líquido, adicione mais leite. Se preferir mais espesso, adicione mais banana.
6. Sirva imediatamente em um copo grande.
7. Para variar: troque a banana por morango congelado ou adicione 1 colher de cacau em pó.`,
            micros: { 'Cálcio': '320mg', 'Vit. B12': '1.5mcg', 'Potássio': '450mg' },
            tags: ['proteico', 'pós-treino', 'rápido'],
        },
        {
            name: 'Crepioca com Queijo e Tomate',
            description: 'Crepioca (tapioca com ovo) recheada com queijo cottage e tomate seco.',
            calories: 230,
            protein: 16,
            carbs: 22,
            fat: 9,
            prepTime: '10 min',
            ingredients: ['2 colheres de goma de tapioca', '1 ovo', '2 colheres de queijo cottage', '3 tomates secos', 'Orégano a gosto'],
            estimatedCost: 4.00,
            preparation: `1. Em uma tigela, misture a goma de tapioca peneirada com o ovo batido até formar uma massa homogênea.
2. Aqueça uma frigideira antiaderente em fogo médio (sem óleo).
3. Despeje a massa na frigideira e espalhe em formato circular fino.
4. Quando a parte de baixo firmar e as bordas começarem a soltar (2-3 minutos), vire cuidadosamente.
5. Adicione o queijo cottage e os tomates secos picados no centro.
6. Polvilhe orégano e dobre ao meio.
7. Deixe por mais 1 minuto para aquecer o recheio.
8. Sirva quente e crocante.`,
            micros: { 'Cálcio': '85mg', 'Vit. A': '75mcg', 'Selênio': '15mcg' },
            tags: ['sem-glúten', 'rápido'],
        },
    ],
    jantar: [
        {
            name: 'Sopa de Legumes com Frango',
            description: 'Sopa nutritiva e reconfortante com frango desfiado e legumes variados.',
            calories: 350,
            protein: 30,
            carbs: 35,
            fat: 8,
            prepTime: '35 min',
            ingredients: ['120g de peito de frango', '1 batata média', '1 cenoura', '1 abobrinha', '1/2 cebola', '2 dentes de alho', 'Salsinha fresca', 'Sal e pimenta'],
            estimatedCost: 6.50,
            preparation: `1. Corte o peito de frango em cubos de 2cm.
2. Em uma panela grande, refogue a cebola picada e o alho em um fio de azeite até dourar.
3. Adicione os cubos de frango e sele por 3-4 minutos até começar a dourar.
4. Descasque e corte a batata e a cenoura em cubos pequenos. Corte a abobrinha em rodelas.
5. Adicione todos os legumes à panela.
6. Cubra com 1 litro de água e tempere com sal e pimenta.
7. Deixe ferver, depois reduza para fogo baixo e cozinhe por 20-25 minutos até todos os legumes ficarem macios.
8. Prove e ajuste o tempero se necessário.
9. Finalize com salsinha fresca picada por cima.
10. Sirva quente. Pode acompanhar com uma fatia de pão integral torrado.`,
            micros: { 'Ferro': '2.8mg', 'Vit. A': '650mcg', 'Vit. C': '25mg' },
            tags: ['low-calorie', 'reconfortante'],
        },
        {
            name: 'Atum Grelhado com Salada Completa',
            description: 'Filé de atum selado acompanhado de salada completa com folhas, grão-de-bico e tomate.',
            calories: 400,
            protein: 38,
            carbs: 28,
            fat: 14,
            prepTime: '20 min',
            ingredients: ['150g de filé de atum fresco (ou 1 lata de atum em água)', '2 xícaras de folhas verdes mistas', '3 colheres de grão-de-bico cozido', '1 tomate', '1/2 pepino', 'Azeite e limão'],
            estimatedCost: 12.00,
            preparation: `1. Se usar atum fresco: tempere com sal, pimenta e suco de limão. Aqueça uma frigideira bem quente com um fio de azeite. Sele o atum por 2 minutos de cada lado (deve ficar rosado por dentro).
2. Se usar atum em lata: escorra bem e reserve.
3. Lave e seque todas as folhas verdes e distribua em um prato grande.
4. Corte o tomate em gomos e o pepino em rodelas.
5. Adicione o grão-de-bico por cima da salada.
6. Coloque o atum fatiado (ou desfiado) no centro.
7. Prepare o molho: misture 1 colher de azeite, suco de meio limão, sal e pimenta.
8. Regue a salada com o molho.
9. Sirva imediatamente.`,
            micros: { 'Ômega 3': '1200mg', 'Vit. D': '5mcg', 'Selênio': '40mcg' },
            tags: ['low-carb', 'peixe'],
        },
        {
            name: 'Frango ao Molho com Batata Doce',
            description: 'Cubos de frango ao molho de tomate caseiro com batata doce assada.',
            calories: 420,
            protein: 35,
            carbs: 42,
            fat: 10,
            prepTime: '40 min',
            ingredients: ['150g de peito de frango', '1 batata doce média', '2 tomates maduros', '1/2 cebola', '2 dentes de alho', 'Manjericão fresco', 'Azeite, sal e pimenta'],
            estimatedCost: 7.50,
            preparation: `1. Pré-aqueça o forno a 200°C.
2. Lave a batata doce, corte em rodelas de 1cm e disponha em uma assadeira.
3. Regue com um fio de azeite, sal e pimenta. Asse por 25-30 minutos até dourar.
4. Enquanto isso, corte o frango em cubos de 3cm e tempere com sal e pimenta.
5. Em uma panela, refogue cebola e alho no azeite até dourar.
6. Adicione os cubos de frango e sele por 5 minutos.
7. Bata os tomates no liquidificador e adicione à panela.
8. Cozinhe em fogo baixo por 15 minutos até o molho reduzir e engrossar.
9. Finalize com manjericão fresco picado.
10. Monte o prato com a batata doce assada e o frango ao molho por cima.`,
            micros: { 'Ferro': '2.5mg', 'Vit. A': '960mcg', 'Vit. C': '35mg' },
            tags: ['reconfortante', 'proteico'],
        },
        {
            name: 'Omelete Recheado com Legumes',
            description: 'Omelete recheado com espinafre, tomate e queijo cottage — opção leve para o jantar.',
            calories: 300,
            protein: 26,
            carbs: 10,
            fat: 18,
            prepTime: '12 min',
            ingredients: ['3 ovos', '1 xícara de espinafre fresco', '1 tomate pequeno picado', '2 colheres de queijo cottage', 'Sal, pimenta e orégano'],
            estimatedCost: 5.00,
            preparation: `1. Bata os ovos em uma tigela com sal, pimenta e orégano.
2. Lave o espinafre e pique grosseiramente. Pique o tomate em cubos pequenos.
3. Aqueça uma frigideira antiaderente em fogo médio com um spray de azeite.
4. Despeje os ovos batidos e incline a frigideira para cobrir toda a superfície.
5. Quando as bordas começarem a firmar, adicione o espinafre, tomate e queijo cottage de um lado.
6. Com uma espátula, dobre a outra metade sobre o recheio.
7. Cozinhe por mais 2 minutos com a frigideira tampada para o queijo aquecer.
8. Deslize para um prato e sirva imediatamente.
9. Acompanhe com uma salada verde simples se desejar.`,
            micros: { 'Ferro': '3.8mg', 'Vit. A': '470mcg', 'Vit. K': '145mcg' },
            tags: ['low-carb', 'rápido', 'vegetariano'],
        },
    ],
    ceia: [
        {
            name: 'Chá de Camomila com Biscoito Integral',
            description: 'Chá relaxante de camomila com biscoitos integrais antes de dormir.',
            calories: 120,
            protein: 3,
            carbs: 22,
            fat: 3,
            prepTime: '5 min',
            ingredients: ['1 sachê de chá de camomila', '200ml de água quente', '3 biscoitos integrais', 'Mel (opcional)'],
            estimatedCost: 2.00,
            preparation: `1. Ferva 200ml de água em uma chaleira ou no microondas.
2. Coloque o sachê de camomila em uma xícara e despeje a água quente.
3. Deixe em infusão por 3-5 minutos (não exceda para não ficar amargo).
4. Retire o sachê e adoce com mel se desejar.
5. Acompanhe com os biscoitos integrais.
6. Consuma pelo menos 30 minutos antes de deitar para melhor digestão.`,
            micros: { 'Cálcio': '15mg', 'Magnésio': '12mg', 'Fibra': '2g' },
            tags: ['vegetariano', 'relaxante', 'noturno'],
        },
        {
            name: 'Iogurte com Frutas Vermelhas',
            description: 'Iogurte grego light com frutas vermelhas, perfeito para encerrar o dia.',
            calories: 150,
            protein: 12,
            carbs: 18,
            fat: 4,
            prepTime: '3 min',
            ingredients: ['1 pote de iogurte grego light (100g)', '1/2 xícara de frutas vermelhas (morango, mirtilo)', '1 colher de chia'],
            estimatedCost: 4.50,
            preparation: `1. Coloque o iogurte grego em uma tigela.
2. Lave bem as frutas vermelhas e distribua por cima.
3. Polvilhe a chia por cima.
4. Consuma lentamente antes de dormir.
5. As frutas vermelhas são ricas em antioxidantes e a chia ajuda na saciedade noturna.`,
            micros: { 'Cálcio': '150mg', 'Vit. C': '28mg', 'Antioxidantes': 'alto' },
            tags: ['vegetariano', 'noturno', 'rápido'],
        },
    ],
};

// ========== MEAL SCHEDULE TEMPLATES ==========

const MEAL_SCHEDULES: Record<number, { name: string; time: string; category: string }[]> = {
    3: [
        { name: 'Café da Manhã', time: '07:30', category: 'cafe_da_manha' },
        { name: 'Almoço', time: '12:00', category: 'almoco' },
        { name: 'Jantar', time: '19:30', category: 'jantar' },
    ],
    4: [
        { name: 'Café da Manhã', time: '07:00', category: 'cafe_da_manha' },
        { name: 'Almoço', time: '12:00', category: 'almoco' },
        { name: 'Lanche da Tarde', time: '15:30', category: 'lanche_tarde' },
        { name: 'Jantar', time: '19:30', category: 'jantar' },
    ],
    5: [
        { name: 'Café da Manhã', time: '07:00', category: 'cafe_da_manha' },
        { name: 'Lanche da Manhã', time: '10:00', category: 'lanche_manha' },
        { name: 'Almoço', time: '12:30', category: 'almoco' },
        { name: 'Lanche da Tarde', time: '16:00', category: 'lanche_tarde' },
        { name: 'Jantar', time: '19:30', category: 'jantar' },
    ],
    6: [
        { name: 'Café da Manhã', time: '06:30', category: 'cafe_da_manha' },
        { name: 'Lanche da Manhã', time: '09:30', category: 'lanche_manha' },
        { name: 'Almoço', time: '12:00', category: 'almoco' },
        { name: 'Lanche da Tarde', time: '15:00', category: 'lanche_tarde' },
        { name: 'Jantar', time: '19:00', category: 'jantar' },
        { name: 'Ceia', time: '21:30', category: 'ceia' },
    ],
};

// ========== UTILITY: SHUFFLE & PICK ==========

function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function shuffleArray<T>(arr: T[], rand: () => number): T[] {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function scaleMeal(meal: MealAlternative, factor: number): MealAlternative {
    return {
        ...meal,
        calories: Math.round(meal.calories * factor),
        protein: Math.round(meal.protein * factor),
        carbs: Math.round(meal.carbs * factor),
        fat: Math.round(meal.fat * factor),
        estimatedCost: Math.round(meal.estimatedCost * factor * 100) / 100,
    };
}

// ========== FILTERING BY PROFILE ==========

function filterMealsByProfile(meals: MealAlternative[], profile: NutritionProfile): MealAlternative[] {
    let filtered = [...meals];
    const r = profile.restrictions;

    // Vegetarian: remove anything with meat/fish keywords
    if (r?.vegetarian) {
        const meatWords = ['frango', 'carne', 'tilápia', 'atum', 'peixe', 'lombo', 'suíno', 'bovina', 'defumado', 'bacon'];
        filtered = filtered.filter(m => {
            const allText = (m.name + ' ' + m.ingredients.join(' ')).toLowerCase();
            return !meatWords.some(w => allText.includes(w));
        });
    }

    // Allergies: exclude meals containing allergen keywords
    if (r?.allergies && r.allergiesDesc) {
        const allergens = r.allergiesDesc.toLowerCase().split(/[,;\s]+/).filter(Boolean);
        filtered = filtered.filter(m => {
            const allText = (m.name + ' ' + m.ingredients.join(' ')).toLowerCase();
            return !allergens.some(a => a.length > 2 && allText.includes(a));
        });
    }

    // Intolerance: exclude meals containing intolerance keywords (e.g. lactose, glúten)
    if (r?.intolerant && r.intoleranceDesc) {
        const intolerances = r.intoleranceDesc.toLowerCase().split(/[,;\s]+/).filter(Boolean);
        const lactoseWords = ['leite', 'queijo', 'iogurte', 'requeijão', 'whey', 'cottage'];
        const glutenWords = ['pão', 'aveia', 'biscoito', 'granola', 'trigo'];
        filtered = filtered.filter(m => {
            const allText = (m.name + ' ' + m.ingredients.join(' ')).toLowerCase();
            for (const intol of intolerances) {
                if (intol.includes('lactose') || intol.includes('leite')) {
                    if (lactoseWords.some(w => allText.includes(w))) return false;
                }
                if (intol.includes('gluten') || intol.includes('glúten')) {
                    if (glutenWords.some(w => allText.includes(w))) return false;
                }
                if (intol.length > 2 && allText.includes(intol)) return false;
            }
            return true;
        });
    }

    // Disliked foods: exclude meals containing disliked food keywords
    if (r?.dislikedFoods && r.dislikedFoodsDesc) {
        const disliked = r.dislikedFoodsDesc.toLowerCase().split(/[,;\s]+/).filter(Boolean);
        filtered = filtered.filter(m => {
            const allText = (m.name + ' ' + m.ingredients.join(' ')).toLowerCase();
            return !disliked.some(d => d.length > 2 && allText.includes(d));
        });
    }

    // Budget: prefer cheaper meals when budget is set
    const budget = parseFloat(profile.monthlyBudget) || 0;
    if (budget > 0 && filtered.length > 2) {
        filtered.sort((a, b) => a.estimatedCost - b.estimatedCost);
        // Keep only the cheapest options based on budget tightness
        const keepRatio = budget < 500 ? 0.5 : budget < 1000 ? 0.65 : 0.75;
        filtered = filtered.slice(0, Math.max(2, Math.ceil(filtered.length * keepRatio)));
    }

    // Fallback: if all meals were filtered out, return unfiltered originals
    return filtered.length > 0 ? filtered : meals;
}

// ========== MAIN GENERATOR ==========

export function generateLocalDiet(profile: NutritionProfile): DietData {
    const dailyCalories = calculateDailyCalories(profile);
    const macros = calculateMacros(dailyCalories, profile.objective);
    const mealsPerDay = parseInt(profile.mealsPerDay) || 5;
    const schedule = MEAL_SCHEDULES[mealsPerDay] || MEAL_SCHEDULES[5];

    // Training intensity adjusts calories slightly
    const intensity = (profile.trainingIntensity || '').toLowerCase();
    let calorieAdjust = 1.0;
    if (intensity.includes('intens') || intensity.includes('pesado') || intensity.includes('alto')) calorieAdjust = 1.05;
    if (intensity.includes('leve') || intensity.includes('baixo')) calorieAdjust = 0.97;
    const adjustedCalories = Math.round(dailyCalories * calorieAdjust);

    // Distribute calories across meals
    const calDistribution: Record<string, number> = {};
    if (mealsPerDay === 3) {
        calDistribution['cafe_da_manha'] = 0.30;
        calDistribution['almoco'] = 0.40;
        calDistribution['jantar'] = 0.30;
    } else if (mealsPerDay === 4) {
        calDistribution['cafe_da_manha'] = 0.25;
        calDistribution['almoco'] = 0.35;
        calDistribution['lanche_tarde'] = 0.15;
        calDistribution['jantar'] = 0.25;
    } else if (mealsPerDay === 5) {
        calDistribution['cafe_da_manha'] = 0.25;
        calDistribution['lanche_manha'] = 0.10;
        calDistribution['almoco'] = 0.30;
        calDistribution['lanche_tarde'] = 0.10;
        calDistribution['jantar'] = 0.25;
    } else {
        calDistribution['cafe_da_manha'] = 0.22;
        calDistribution['lanche_manha'] = 0.08;
        calDistribution['almoco'] = 0.28;
        calDistribution['lanche_tarde'] = 0.10;
        calDistribution['jantar'] = 0.25;
        calDistribution['ceia'] = 0.07;
    }

    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const weeklyDiet: { [day: string]: Meal[] } = {};
    let totalWeeklyCost = 0;

    dayNames.forEach((dayName, dayIdx) => {
        const rand = seededRandom(dayIdx * 1000 + adjustedCalories);
        const dayMeals: Meal[] = [];

        schedule.forEach((slot) => {
            const category = slot.category;
            const rawPool = MEAL_DATABASE[category] || MEAL_DATABASE['lanche_manha'];
            // Filter meals by user's restrictions, allergies, and preferences
            const pool = filterMealsByProfile(rawPool, profile);
            const targetCalories = adjustedCalories * (calDistribution[category] || 0.15);

            const shuffled = shuffleArray(pool, rand);
            // Always generate 6 alternatives (1 principal + 5 substitutions), cycling through pool if needed
            const numAlternatives = 6;
            const alternatives: MealAlternative[] = [];

            for (let i = 0; i < numAlternatives; i++) {
                const baseMeal = shuffled[i % shuffled.length];
                const scaleFactor = targetCalories / baseMeal.calories;
                const scaled = scaleMeal(baseMeal, scaleFactor);
                // If cycling, add a small variation to differentiate
                if (i >= shuffled.length) {
                    scaled.name = `${scaled.name} (variação ${i - shuffled.length + 2})`;
                    scaled.calories = Math.round(scaled.calories * (0.95 + (i % 3) * 0.05));
                }
                alternatives.push(scaled);
                if (i === 0) totalWeeklyCost += scaled.estimatedCost;
            }

            dayMeals.push({
                meal: slot.name,
                time: slot.time,
                alternatives,
            });
        });

        weeklyDiet[dayName] = dayMeals;
    });

    // Generate shopping list from selected alternatives
    const shoppingMap: Record<string, { quantity: number; unit: string; price: number; category: string }> = {};
    const ingredientCategories: Record<string, string> = {
        'frango': 'Carnes', 'peito de frango': 'Carnes', 'carne moída': 'Carnes', 'atum': 'Carnes',
        'tilápia': 'Carnes', 'lombo suíno': 'Carnes', 'ovo': 'Ovos e Laticínios', 'claras': 'Ovos e Laticínios',
        'leite': 'Ovos e Laticínios', 'iogurte': 'Ovos e Laticínios', 'queijo': 'Ovos e Laticínios',
        'arroz': 'Grãos', 'aveia': 'Grãos', 'feijão': 'Grãos', 'granola': 'Grãos', 'tapioca': 'Grãos',
        'pão': 'Padaria', 'biscoito': 'Padaria',
        'banana': 'Frutas', 'morango': 'Frutas', 'laranja': 'Frutas', 'limão': 'Frutas',
        'tomate': 'Verduras e Legumes', 'brócolis': 'Verduras e Legumes', 'cenoura': 'Verduras e Legumes',
        'alface': 'Verduras e Legumes', 'espinafre': 'Verduras e Legumes', 'batata': 'Verduras e Legumes',
        'abobrinha': 'Verduras e Legumes', 'cebola': 'Verduras e Legumes', 'alho': 'Verduras e Legumes',
        'azeite': 'Temperos e Óleos', 'sal': 'Temperos e Óleos', 'pimenta': 'Temperos e Óleos',
        'mel': 'Temperos e Óleos', 'canela': 'Temperos e Óleos',
        'castanha': 'Grãos e Sementes', 'chia': 'Grãos e Sementes', 'pasta de amendoim': 'Grãos e Sementes',
        'whey': 'Suplementos',
    };

    Object.values(weeklyDiet).forEach(meals => {
        meals.forEach(meal => {
            const alt = meal.alternatives[0]; // main alternative
            if (alt?.ingredients) {
                alt.ingredients.forEach(ing => {
                    const key = ing.toLowerCase();
                    let cat = 'Outros';
                    for (const [keyword, category] of Object.entries(ingredientCategories)) {
                        if (key.includes(keyword)) {
                            cat = category;
                            break;
                        }
                    }
                    if (!shoppingMap[ing]) {
                        shoppingMap[ing] = { quantity: 1, unit: '', price: alt.estimatedCost / (alt.ingredients.length || 1), category: cat };
                    } else {
                        shoppingMap[ing].quantity += 1;
                    }
                });
            }
        });
    });

    const shoppingList: ShoppingItem[] = Object.entries(shoppingMap).map(([item, data]) => ({
        item,
        quantity: `${data.quantity}x para a semana`,
        estimatedPrice: Math.round(data.price * data.quantity * 100) / 100,
        category: data.category,
    }));

    // Personalized Tips based on profile
    const tips: string[] = [
        `Sua meta calórica diária é de ${adjustedCalories} kcal, calculada para seu peso de ${profile.weight}kg, altura de ${profile.height}cm e objetivo de "${profile.objective}".`,
        `Beba pelo menos ${Math.round((parseFloat(profile.weight) || 70) * 0.035 * 10) / 10} litros de água por dia (35ml por kg de peso corporal).`,
    ];
    if (profile.desiredWeight && profile.weight) {
        const diff = Math.abs(parseFloat(profile.desiredWeight) - parseFloat(profile.weight));
        if (diff > 0) tips.push(`Sua meta é ir de ${profile.weight}kg para ${profile.desiredWeight}kg. Com consistência, você chega lá!`);
    }
    if (profile.restrictions?.vegetarian) {
        tips.push(`Sua dieta foi adaptada para ser vegetariana. Priorize combinações de leguminosas + cereais para garantir aminoácidos completos.`);
    }
    if (profile.restrictions?.intolerant) {
        tips.push(`Alimentos com ${profile.restrictions.intoleranceDesc} foram excluídos da sua dieta. Fique atento aos rótulos!`);
    }
    if (parseFloat(profile.monthlyBudget) > 0) {
        tips.push(`Seu orçamento mensal é R$${profile.monthlyBudget}. Priorizamos opções mais econômicas para caber no seu bolso.`);
    }
    tips.push(`Prepare suas refeições com antecedência (meal prep) aos domingos para facilitar a semana.`);
    tips.push(`Mastigue devagar — leva 20 minutos para o cérebro registrar saciedade.`);

    // Budget constraint: if monthly cost exceeds budget, scale down all costs proportionally
    let finalWeeklyCost = totalWeeklyCost;
    let finalMonthlyCost = totalWeeklyCost * 4.3;
    const budget = parseFloat(profile.monthlyBudget) || 0;
    
    if (budget > 0 && finalMonthlyCost > budget) {
        const costScaleFactor = budget / finalMonthlyCost;
        // Scale down all meal costs
        Object.values(weeklyDiet).forEach(meals => {
            meals.forEach(meal => {
                meal.alternatives.forEach(alt => {
                    alt.estimatedCost = Math.round(alt.estimatedCost * costScaleFactor * 100) / 100;
                });
            });
        });
        // Scale shopping list prices too
        shoppingList.forEach(item => {
            item.estimatedPrice = Math.round(item.estimatedPrice * costScaleFactor * 100) / 100;
        });
        finalWeeklyCost = Math.round(budget / 4.3 * 100) / 100;
        finalMonthlyCost = budget;
        tips.unshift(`⚠️ Os custos foram ajustados para caber no seu orçamento de R$${budget}. Priorize feiras livres e compras em atacado para manter esses valores.`);
    }

    return {
        weeklyDiet,
        weeklyEstimatedCost: Math.round(finalWeeklyCost * 100) / 100,
        monthlyEstimatedCost: Math.round(finalMonthlyCost * 100) / 100,
        dailyCalories: adjustedCalories,
        macroSplit: macros,
        shoppingList,
        tips,
    };
}
