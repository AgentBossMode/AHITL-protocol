"use client";

import { useCopilotAction } from "@copilotkit/react-core";
import { CopilotChat, CopilotKitCSSProperties} from "@copilotkit/react-ui";
import { useState } from "react";
import { useLangGraphInterrupt } from "@copilotkit/react-core";
import validator from "@rjsf/validator-ajv8";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { IChangeEvent } from "@rjsf/core";
import Form from '@rjsf/mui';

const THEME_COLOR = "#3b82f6";

export default function CopilotKitPage() {
  useLangGraphInterrupt<string>({
    render: ({ event, resolve }) => {
      let dgui_form: any = {};
      try {
        // The event.value can be a JSON string or an object representing the DGUI form.
        if (typeof event.value === 'string') {
          console.log("Parsing DGUI form from string:", event.value);
          dgui_form = JSON.parse(event.value);
        } else if (typeof event.value === 'object' && event.value !== null) {
          dgui_form = event.value;
        }

        if (dgui_form.type !== 'dgui_form' || !dgui_form.schema) {
          throw new Error("Invalid DGUI form structure.");
        }

      } catch (error) {
        console.error("Failed to parse DGUI form:", error);
        // Gracefully handle cases where the value is not a valid DGUI form
        resolve(JSON.stringify({ type: "dgui_error", message: "Invalid DGUI form structure.", payload: event.value }));
        return null;
      }

      const onSubmit = (data: IChangeEvent) => {
        // When the form is submitted, we resolve the promise with the form data.
        // The agent expects a dgui_response message.
        resolve(JSON.stringify({ type: "dgui_response", data: data.formData }));
      };

      return (
        <div>
          <h2>{dgui_form.title}</h2>
          <p>{dgui_form.description}</p>
          <Form schema={JSON.parse(dgui_form.schema)} uiSchema={JSON.parse(dgui_form.uiSchema)} validator={validator} onSubmit={onSubmit} />
        </div>
      );
    },
  });
  

  return (
    <div style={{ "--copilot-kit-primary-color": THEME_COLOR, height: "100vh", width: "100vw" } as CopilotKitCSSProperties}>
      <Allotment defaultSizes={[70, 30]}>
        <Allotment.Pane>
          <YourMainContent themeColor={THEME_COLOR} />
        </Allotment.Pane>
        <Allotment.Pane>
          {/* We use CopilotChat for a persistent, inline chat experience */}
          <CopilotChat
        
        className="h-full"
        labels={{
          title: "Popup Assistant",
          initial: "👋 Hi, there! I'm a dynamic UI agent.\n\nYou can ask me to create a form directly (e.g., \"Create a pizza order form\").\n\nOr, you can ask me to perform a task. If I'm missing information, I'll generate a form to get the details I need. For example:\n- \"Calculate the area of a rectangle\"\n- \"Book a trip to Japan\"\n\nWatch the form appear in real-time!"
        }}
      />
        </Allotment.Pane>
      </Allotment>
    </div>
  );
}

function YourMainContent({ themeColor }: { themeColor: string }) {
  useCopilotAction({
    name: "generateJsonSchema",
    parameters: [{
      name: "jsonSchema",
      description: "Generates the rjsf compatible json schema for the form you want to create. The schema should be a valid JSON schema object or a JSON string.",
      required: true, 
    }],
    handler({ jsonSchema }) {
      let schemaObject: object;
      let schemaString: string;

      if (typeof jsonSchema === 'string') {
        try {
          schemaObject = JSON.parse(jsonSchema);
          schemaString = JSON.stringify(schemaObject, null, 2);
        } catch (error) {
          console.error("Failed to parse JSON schema string from agent:", error);
          return; // Or handle the error appropriately
        }
      } else if (typeof jsonSchema === 'object' && jsonSchema !== null) {
        schemaObject = jsonSchema;
        schemaString = JSON.stringify(jsonSchema, null, 2);
      } else {
        console.error("Invalid schema format received from agent:", jsonSchema);
        return;
      }

      setSchema(schemaObject);
      setSchemaString(schemaString);
    },
    render({ args, status }) {
      return (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 ease-in-out hover:shadow-2xl">
          <div className="p-6">
            {status === "complete" ? (
              <>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{args.jsonSchema ? JSON.parse(args.jsonSchema).title : "Generated Form"}</h2>
                <p className="text-gray-600">Your form is generated on the left pane!</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Generating Form...</h2>
                <p className="text-gray-600">The agent is generating the form based on your request.</p>
              </>
            )}
          </div>
        </div>
      );
    }
  });

  const exampleSchemas = {
    simple: {
      title: "Simple Form",
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", title: "Name", default: "A. User" },
        age: { type: "number", title: "Age" },
        isStudent: { type: "boolean", title: "Is a student?", default: false },
      },
    },
    pizza: {
      "title": "Pizza Order",
      "type": "object",
      "properties": {
        "size": { "type": "string", "title": "Size", "enum": ["small", "medium", "large"] },
        "toppings": { "type": "array", "title": "Toppings", "items": { "type": "string" } },
        "crust": { "type": "string", "title": "Crust", "enum": ["thin", "thick", "stuffed"] }
      },
      "required": ["size", "crust"]
    }
  };

  const [schema, setSchema] = useState<object>(exampleSchemas.simple);
  const [formData, setFormData] = useState({});
  const [schemaString, setSchemaString] = useState(JSON.stringify(exampleSchemas.simple, null, 2));

  const handleSchemaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newSchemaString = event.target.value;
    setSchemaString(newSchemaString);
    try {
      const newSchema = JSON.parse(newSchemaString);
      setSchema(newSchema);
    } catch (error) {
      // Invalid JSON, do nothing with the schema object
    }
  };

  return (
    <div
      style={{ backgroundColor: themeColor }}
      className="h-full w-full flex justify-center items-center flex-col transition-colors duration-300 p-8 overflow-auto"
    >
      <div className="bg-white/20 backdrop-blur-md p-8 rounded-2xl shadow-xl max-w-4xl w-full">
        <h1 className="text-4xl font-bold text-white mb-2 text-center">Dynamic Generative UI Playground</h1>
        <p className="text-gray-200 text-center italic mb-6">Edit the schema on the left and see the form update on the right. You can also ask the agent to "create a form to order a pizza".</p>
        <hr className="border-white/20 my-6" />
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Schema Editor</h2>
            <div className="flex gap-2 mb-4">
              {Object.entries(exampleSchemas).map(([key, value]) => (
                <button key={key} onClick={() => { setSchema(value); setSchemaString(JSON.stringify(value, null, 2)); }} className="bg-white/30 text-white px-3 py-1 rounded-md text-sm capitalize hover:bg-white/40">{key}</button>
              ))}
            </div>
            <textarea value={schemaString} onChange={handleSchemaChange} className="w-full h-96 bg-black/20 text-white p-4 rounded-lg font-mono text-sm border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"></textarea>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Rendered Form</h2>
            <Form schema={schema} validator={validator} formData={formData} onChange={(e) => setFormData(e.formData)} onSubmit={(data) => alert("Submitted: " + JSON.stringify(data.formData, null, 2))} />
          </div>
        </div>
      </div>
    </div>
  );
}