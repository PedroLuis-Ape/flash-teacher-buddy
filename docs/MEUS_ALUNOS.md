# Meus Alunos - Documentação

## Visão Geral

O módulo **Meus Alunos** permite que professores (`is_teacher=true`) gerenciem seus alunos que os seguem/estão inscritos, adicionem-nos a turmas e atribuam atividades diretamente.

## Feature Flag

```typescript
VITE_FEATURE_MEUS_ALUNOS=true
```

Quando `false`, todas as rotas e funcionalidades são ocultadas.

## Rotas

- `/professor/alunos` - Lista de alunos
- `/professor/alunos/:alunoId` - Perfil do aluno (visão do professor)

## Endpoints

### GET /professor/students.list

Lista alunos que seguem o professor logado.

**Query Params:**
- `cursor` (opcional): Para paginação
- `q` (opcional): Busca por nome ou ape_id
- `status` (opcional): Filtro por status

**Response:**
```json
{
  "students": [
    {
      "aluno_id": "uuid",
      "nome": "string",
      "ape_id": "string",
      "avatar_skin_id": "string",
      "desde_em": "timestamp",
      "status": "ativo",
      "origem": "follow"
    }
  ],
  "nextCursor": "string | null",
  "hasMore": boolean
}
```

### POST /professor/students.addToClass

Adiciona alunos a uma turma em lote (idempotente).

**Body:**
```json
{
  "turma_id": "uuid",
  "student_ids": ["uuid", "uuid", ...]
}
```

**Response:**
```json
{
  "success": true,
  "added_count": number,
  "message": "Alunos adicionados à turma."
}
```

### POST /professor/students.assign

Atribui atividade diretamente a alunos (sem turma ou cria turma pessoal).

**Body:**
```json
{
  "student_ids": ["uuid", ...],
  "titulo": "string",
  "descricao": "string (opcional)",
  "fonte_tipo": "lista|pasta|reino",
  "fonte_id": "uuid",
  "data_limite": "timestamp (opcional)",
  "pontos_vale": number (opcional, default: 50)
}
```

**Response:**
```json
{
  "success": true,
  "created_count": number,
  "assignments": [
    { "student_id": "uuid", "atribuicao_id": "uuid" }
  ],
  "errors": [ /* opcional */ ],
  "message": "Atribuição enviada."
}
```

### GET /professor/students.overview

Visão resumida do progresso do aluno.

**Query Params:**
- `aluno_id`: UUID do aluno

**Response:**
```json
{
  "student": {
    "id": "uuid",
    "first_name": "string",
    "ape_id": "string",
    "level": number,
    "xp_total": number,
    "pts_weekly": number,
    "balance_pitecoin": number
  },
  "assignments": [ /* últimas 10 atribuições */ ],
  "commonTurmas": [ /* turmas em comum */ ],
  "lastDmMessage": { /* última mensagem DM */ }
}
```

## Modelo de Dados

Reutiliza a tabela `subscriptions`:
- `teacher_id`: Professor
- `student_id`: Aluno
- `created_at`: Data de inscrição

**RLS:**
- Professor só vê alunos que o seguem
- Aluno só vê própria relação

## Validações

1. Autenticação obrigatória (JWT)
2. Professor deve ser `is_teacher=true`
3. `addToClass`: verifica ownership da turma
4. `assign`: verifica relação professor↔aluno via `subscriptions`
5. Idempotência em operações em lote

## UI/UX

### /professor/alunos
- Busca por nome/ape_id
- Seleção em massa (checkbox)
- Ações em lote: Adicionar à Turma, Atribuir Atividade, DM

### /professor/alunos/:alunoId
- Cards: Progresso, Atribuições, Turmas em Comum
- Botão: Abrir DM

## Estados Vazios

- "Nenhum aluno encontrado."
- "Selecione ao menos 1 aluno."
- "Sem progresso recente."

## Testes de Aceitação

1. ✅ Professor acessa `/professor/alunos` e vê lista paginada
2. ✅ Busca por ape_id funciona
3. ✅ Adicionar 3 alunos à turma (sem duplicatas)
4. ✅ Atribuir atividade a 2 alunos (cria entradas individuais)
5. ✅ Abrir perfil do aluno e ver progresso/turmas/DM
6. ✅ Aluno não acessa rotas `/professor/*`
7. ✅ Sem 401 no console sem autenticação

## Segurança

- RLS estrita em `subscriptions`
- Teacher_id = auth.uid() em todas as rotas
- ACL: professor só vê seus alunos
- Sem notificações push

## Dependências

- Blocos 1 e 2 (Turmas + Atribuições + Mensagens)
- Tabela `subscriptions` existente
- Feature flag `VITE_FEATURE_MEUS_ALUNOS`
