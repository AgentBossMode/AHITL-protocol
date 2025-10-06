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
> “Please provide the departure date, destination city, and return date for your flight to Japan”,  
> the model can emit a DGUI form schema that renders appropriate inputs.

---

## 3. Core Protocol

### 3.1. Message Types

The DGUI protocol defines two primary message types:

| Type | Description |
|------|--------------|
| `dgui_form` | Message containing schema for rendering a form |
| `dgui_response` | Message containing structured data entered by user |

### 3.2. Form Message Structure

A `dgui_form` message is sent from the agent to the client. It must conform to the following shape:

```json
{
  "type": "dgui_form",
  "title": "Book a Flight to Japan",
  "description": "Please provide the details for your flight booking.",
  "schema": {
    "type": "object",
    "properties": {
      "destinationCity": {
        "type": "string",
        "title": "Destination City",
        "default": "Tokyo"
      },
      "departureDate": {
        "type": "string",
        "title": "Departure Date",
        "format": "date"
      },
      "returnDate": {
        "type": "string",
        "title": "Return Date",
        "format": "date"
      }
    },
    "required": ["destinationCity", "departureDate"]
  },
  "uiSchema": {
    "departureDate": {
      "ui:widget": "date"
    },
    "returnDate": {
      "ui:widget": "date"
    }
  },
  "metadata": {
    "version": "0.1",
    "agent_context": "flight_booking"
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
    "destinationCity": "Tokyo",
    "departureDate": "2025-12-25",
    "returnDate": "2026-01-10"
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
     | --- User says: "Book a ticket to Japan" --> |                                  |
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
You are a helpful assistant, you are very careful to not take any assumptions.
For user queries, If you need more information ALWAYS use the ask_question tool, read the definition of ask_question to see if it fits
```

**ask_question tool description:**

```text
Asks the user for structured information by generating a form.

This tool should be used when you need to gather multiple pieces of information
from the user to proceed. The `question` parameter must be a serialized JSON string that
conforms to the react-jsonschema-form (RJSF) schema.

The agent is responsible for generating the RJSF schema as a JSON string
based on the information it needs to collect from the user.

Args:
    question: A serialized JSON string representing a form schema that adheres to react-jsonschema-form.
    uiSchema: A serialized JSON string representing the UI schema for the form.

Examples:
    1. Subtle Creation Task:
        If the user says: "I need to schedule a meeting with the marketing team about the Q3 launch."
        The agent can infer the need for structured data and generate a form for: Meeting Title, Attendees (array of emails), Date/Time, and Agenda (textarea).

    2. Implied Filtering or Searching:
        If the user says: "I'm looking for a used car, maybe a Honda or Toyota, under $15,000."
        The agent can generate a search form with fields for: Make (multi-select), Model, and Max Price (number slider).

    3. Vague Update Request:
        If the user says: "My shipping address is wrong, I moved recently."
        The agent can generate a form to update the address with fields for: Street, City, State, and Zip Code.

    4. Configuration or Settings Change:
        If the user says: "I'm getting too many alerts, I want to change my notification settings."
        The agent can present a form with: Email Alerts (boolean), Push Notifications (boolean), and a Daily Digest Time (time picker).

    5. Missing Context or Details:
        If the user says: "Book a flight for me next week."
        The agent can generate a form to gather: Departure City, Destination City, Departure Date, Return Date, and Preferred Airline.

    6. Complex Requests:
        If the user says: "Plan a weekend getaway for me."
        The agent can generate a form to collect: Destination, Budget, Activities (multi-select) and Accommodation Type (dropdown).

    7. Ambiguous Commands:
        If the user says: "Set up my profile."
        The agent can generate a form to gather: Full Name, Profile Picture (file upload), Bio (textarea), and Social Media Links (array of URLs).

    8. Multi-step Processes:
        If the user says: "What is the area of a rectangle?"
        The agent can generate a form to collect: Length (number) and Width (number).

    9. Confirming what user is referring to:
        How much does it cost? or What is the price of...?
        Agent will check from memory what "it" is and could either give confirmation button or a radio in case of multiple items.
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

---

## 12. Contact

**Author:** [Kanishk Gupta](https://github.com/kanishkgupta2000)  
**Spec Repository:** [https://github.com/AgentBossMode/DGUI-protocol](https://github.com/AgentBossMode/DGUI-protocol)

---