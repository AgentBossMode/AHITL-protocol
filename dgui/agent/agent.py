"""
This is the main entry point for the agent.
It defines the workflow graph, state, tools, nodes and edges.
"""

from typing import Any, List
from typing_extensions import Literal
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, BaseMessage
from langchain_core.runnables import RunnableConfig
from langchain.tools import tool
from langgraph.graph import StateGraph, END
from langgraph.types import Command
from langgraph.graph import MessagesState
from langgraph.prebuilt import ToolNode
from langgraph.types import interrupt

class AgentState(MessagesState):
    """
    Here we define the state of the agent

    In this instance, we're inheriting from CopilotKitState, which will bring in
    the CopilotKitState fields. We're also adding a custom field, `language`,
    which will be used to set the language of the agent.
    """
    proverbs: List[str] = []
    tools: List[Any]
    # your_custom_agent_state: str = ""

@tool
def get_weather(location: str):
    """
    Get the weather for a given location.
    """
    return f"The weather for {location} is 70 degrees."

@tool 
def ask_question(question: str, uiSchema: str) -> str:
    """Asks the user for structured information by generating a form.
    
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
    """
    print(f"Interrupting to ask question: {question}")
    print(f"With uiSchema: {uiSchema}")

    # wrap the question into the dgui_form format
    question = {
        "type": "dgui_form",
        "title": "Additional Information Required",
        "description": "Please fill out the following form to provide the necessary information.",
        "schema": question,
        "uiSchema": uiSchema
    }
    value = interrupt(question)
    print(f"Received answer: {value}")
    return value

backend_tools = [
    get_weather,
    ask_question
]

# Extract tool names from backend_tools for comparison
backend_tool_names = [tool.name for tool in backend_tools]


async def chat_node(state: AgentState, config: RunnableConfig) -> Command[Literal["tool_node", "__end__"]]:
    """
    Standard chat node based on the ReAct design pattern. It handles:
    - The model to use (and binds in CopilotKit actions and the tools defined above)
    - The system prompt
    - Getting a response from the model
    - Handling tool calls

    For more about the ReAct design pattern, see:
    https://www.perplexity.ai/search/react-agents-NcXLQhreS0WDzpVaS4m9Cg
    """

    # 1. Define the model
    model = ChatOpenAI(model="gpt-4o-mini")

    # 2. Bind the tools to the model
    model_with_tools = model.bind_tools(
        [
            *state.get("tools", []), # bind tools defined by ag-ui
            *backend_tools,
            # your_tool_here
        ],

        # 2.1 Disable parallel tool calls to avoid race conditions,
        #     enable this for faster performance if you want to manage
        #     the complexity of running tool calls in parallel.
        parallel_tool_calls=False,
    )

    # 3. Define the system message by which the chat model will be run
    system_message = SystemMessage(
        content="""
        You are a helpful assistant, you are very careful to not take any assumptions.
        You have two tools: ask_question and generateJsonSchema tools.
        If the user query directly asks you to build a form, you must use the generateJsonSchema tool.
        For other user queries, If you need more information ALWAYS use the ask_question tool, read the definition of ask_question to see if it fits
        """

    )

    # 4. Run the model to generate a response
    response = await model_with_tools.ainvoke([
        system_message,
        *state["messages"],
    ], config)

    # only route to tool node if tool is not in the tools list
    if route_to_tool_node(response):
        print("routing to tool node")
        return Command(
            goto="tool_node",
            update={
                "messages": [response],
            }
        )

    # 5. We've handled all tool calls, so we can end the graph.
    return Command(
        goto=END,
        update={
            "messages": [response],
        }
    )

def route_to_tool_node(response: BaseMessage):
    """
    Route to tool node if any tool call in the response matches a backend tool name.
    """
    tool_calls = getattr(response, "tool_calls", None)
    if not tool_calls:
        return False

    for tool_call in tool_calls:
        if tool_call.get("name") in backend_tool_names:
            return True
    return False

# Define the workflow graph
workflow = StateGraph(AgentState)
workflow.add_node("chat_node", chat_node)
workflow.add_node("tool_node", ToolNode(tools=backend_tools))
workflow.add_edge("tool_node", "chat_node")
workflow.set_entry_point("chat_node")

graph = workflow.compile()
