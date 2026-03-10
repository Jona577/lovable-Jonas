
# Formulario de Metas sem barra de rolagem

## Problema
Atualmente o formulario de adicionar meta usa `overflow-y-auto` com `space-y-8`, criando uma area rolavel. Os campos ocupam muito espaco vertical por causa dos paddings grandes e espacamentos entre campos.

## Solucao
Alterar o layout do formulario para que todos os campos caibam na tela de uma vez, sem scroll:

1. **Remover scroll** - Trocar `overflow-y-auto` por `overflow-hidden` e usar `justify-between` ou `justify-center` para distribuir o conteudo
2. **Reduzir espacamentos** - Diminuir `space-y-8` para `space-y-4` entre os campos
3. **Reduzir paddings dos inputs** - Trocar `py-4` por `py-3` nos inputs e textarea
4. **Reduzir rows do textarea** - De 3 para 2 linhas
5. **Reduzir espacamento entre label e input** - De `space-y-3` para `space-y-2`
6. **Ajustar padding geral** - Reduzir `pb-6` e usar o espaco de forma mais eficiente

## Detalhes tecnicos

No arquivo `src/components/Goals.tsx`:
- Linha 177: Trocar `flex-1 overflow-y-auto px-6 pb-6 space-y-8` por `flex-1 flex flex-col justify-center px-6 pb-6 space-y-4`
- Campos internos: reduzir `space-y-3` para `space-y-2`
- Inputs: trocar `py-4` por `py-3`
- Textarea: reduzir `rows={3}` para `rows={2}`
- Botao salvar: trocar `py-4` por `py-3`
