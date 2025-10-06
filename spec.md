# DGUI Specification v0.1 (Draft)

**Version:** 0.1  
**Status:** Experimental  
**Author:** Kanishk Gupta  
**License:** MIT  

---

## 1. Overview

**DGUI (Dynamic Graphical User Interface)** is an open protocol that enables **AI agents to generate interactive UI components on demand**.

Agents can describe forms declaratively via JSON Schema, allowing clients (frontends, SDKs, or tools) to render structured inputs instead of relying solely on free-text prompts.

This creates a **bidirectional communication layer** between reasoning models and human users — enabling a new UX pattern for LLM-driven systems.

---

## 2. Motivation

LLM-based agents typically use plain-text conversations to ask for input.  
This is inefficient for structured data (e.g., configurations, options, numeric parameters).

DGUI provides a **standard JSON-based schema** that describes what UI should be shown and what kind of data should be returned.

> Example: Instead of saying  
> “Please type your project name, framework, and whether you use TypeScript”,  
> the model can emit a DGUI form schema that renders appropriate inputs.

---

## 3. Core Protocol

### 3.1. Message Types

The DGUI protocol defines two primary message types:

| Type | Description |
|------|--------------|
| `dgui_form` | Message containing schema for rendering a form |
| `dgui_response` | Message containing structured data entered by user |

---

### 3.2. Form Message Structure

A `dgui_form` message must conform to the following shape:

```json
{
  "type": "dgui_form",
  "title": "Collect project setup details",
  "description": "Provide inputs to configure your project environment.",
  "schema": {
    "type": "object",
    "properties": {
      "project_name": {
        "type": "string",
        "title": "Project Name"
      },
      "framework": {
        "type": "string",
        "title": "Framework",
        "enum": ["React", "Next.js", "Vite"]
      },
      "use_typescript": {
        "type": "boolean",
        "title": "Use TypeScript?"
      }
    },
    "required": ["project_name", "framework"]
  },
  "uiSchema": {
    "framework": { "ui:widget": "select" }
  },
  "metadata": {
    "version": "0.1",
    "agent_context": "project_setup"
  }
}
```

#### Required fields
- `type`: Always `"dgui_form"`.
- `schema`: A valid [JSON Schema](https://json-schema.org/) object describing expected fields.

#### Optional fields
- `title`, `description`: Short descriptive metadata for the UI.
- `uiSchema`: Client-specific layout or widget hints (conforming to [RJSF](https://rjsf-team.github.io/react-jsonschema-form/)).
- `metadata`: Additional contextual data (agent state, timestamps, etc).

---

### 3.3. Response Message Structure

When a user submits the form, clients must emit a `dgui_response` message:

```json
{
  "type": "dgui_response",
  "data": {
    "project_name": "promptius",
    "framework": "Vite",
    "use_typescript": true
  }
}
```

#### Required fields
- `type`: Always `"dgui_response"`.
- `data`: A JSON object matching the schema defined in the previous `dgui_form`.

---

### 3.4. Example Flow

```text
   Agent                                Client                               User
     |                                      |                                  |
     | --- Emits dgui_form JSON ---------->  |                                  |
     |                                      |                                  |
     |                                      | --- Renders interactive form --> |
     |                                      |                                  |
     |                                      |  <-- Fills form fields --------- |
     |                                      |                                  |
     |  <-- Sends dgui_response JSON -----  |                                  |
     |                                      |                                  |
     | --- Resumes reasoning with input --> |                                  |
```

---

## 4. Agent Prompting Convention

LLMs should be explicitly instructed to emit DGUI-compatible JSON when structured input is needed.

**Prompt Template Example:**

```text
If you require the user to provide structured input, 
output only a JSON object following this structure:

{
  "type": "dgui_form",
  "title": "...",
  "description": "...",
  "schema": {...},
  "uiSchema": {... (optional) ...}
}

Do not include natural language outside of the JSON.
```

This ensures the model produces valid, parseable DGUI payloads.

---

## 5. Client Implementation Guidelines

Any frontend or SDK implementing DGUI should:

1. Detect messages with `"type": "dgui_form"`.
2. Parse and validate the `schema` field.
3. Render interactive components using a compatible library (e.g., [RJSF](https://rjsf-team.github.io/react-jsonschema-form/)).
4. On submission, return a `dgui_response` message to the runtime environment.

### Reference Clients

| Package | Description |
|----------|--------------|
| `@dgui/react` | React-based form renderer |
| `@dgui/langchain` | Helper for LangChain tool output/input |
| `@dgui/examples` | Sample projects demonstrating DGUI forms |

---

## 6. Runtime Behavior

- **Stateless:** Each DGUI message is independent; the agent handles continuity.  
- **Transport-agnostic:** DGUI can be exchanged over WebSockets, HTTP, or in-memory channels.  
- **LLM-neutral:** Works with any model that supports structured output (e.g., OpenAI, Anthropic, Mistral).  

---

## 7. Validation Rules

1. All DGUI payloads **must be valid JSON**.
2. `schema` **must** conform to JSON Schema Draft-07 or newer.
3. `uiSchema` is optional and non-normative.
4. Clients **must not** modify `schema` fields before rendering.
5. Responses **must** include all required fields specified in `schema.required`.

---

## 8. Error Handling

If a client receives invalid DGUI JSON:

```json
{
  "type": "dgui_error",
  "message": "Invalid JSON schema. Missing 'properties' field.",
  "payload": { ...original data... }
}
```

Implementations should fail gracefully and notify both the user and agent environment.

---

## 9. Versioning

- DGUI follows **semantic versioning (semver)**.
- `metadata.version` is optional but recommended.
- Backward compatibility is expected between minor versions (0.x.y).

---

## 10. Future Extensions (Proposed)

| Feature | Description |
|----------|--------------|
| Stateful Sessions | Allow multi-step form continuation |
| Typed Bindings | Zod / TypeBox schema helpers |
| Component Metadata | `ui:hint`, `ui:group`, conditional visibility |
| DGUI Server | Persistent form registry for agent frameworks |

---

## 11. References

- [JSON Schema](https://json-schema.org/)
- [React JSON Schema Form (RJSF)](https://rjsf-team.github.io/react-jsonschema-form/)
- [LangGraph](https://www.langchain.com/langgraph)
- [CopilotKit](https://www.copilotkit.ai/)
- [LangChain](https://www.langchain.com/)

---

## 12. Contact

**Author:** [Kanishk Gupta](https://github.com/kanishkgpt)  
**Twitter/X:** [@kanishkgpt](https://twitter.com/kanishkgpt)  
**Spec Repository:** [https://github.com/kanishkgpt/dgui](https://github.com/kanishkgpt/dgui)

---
