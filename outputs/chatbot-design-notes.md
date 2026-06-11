# AI-Powered Commercial Chatbot Design

## Model Approach

This prototype uses a retrieval-based chatbot. User queries are normalized, matched against predefined commercial intent patterns, scored with keyword and phrase matches, and answered instantly from approved business responses.

Retrieval-based design is a good fit for website commerce because it is fast, predictable, easy to audit, and safer for policies such as refunds, delivery timelines, payments, and handoff.

## Trained Intents

The chatbot is trained with predefined input patterns for these commercial intents:

- Shipping and delivery
- Returns, refunds, and exchanges
- Coupons, discounts, and offers
- Order tracking and cancellation
- Payment methods and invoices
- Product recommendations
- Human agent handoff

Each intent includes:

- A business label
- Example user patterns
- Keywords for scoring
- A pre-approved response
- Follow-up quick replies for engagement

## Website Integration

The chatbot is embedded as a floating support widget on a sample commercial website interface. It includes:

- Persistent launcher button
- Chat header with online status
- Message history
- Typing indicator
- Quick reply chips
- Reset and close controls
- Mobile full-screen chat mode

The same widget can be added to a target website by copying the HTML section, CSS styles, and JavaScript intent logic, then replacing BrightCart content with the target brand and policy data.

## Accuracy Optimization

The prototype improves answer accuracy through:

- Text normalization
- Phrase matching
- Keyword scoring
- Confidence calculation
- Fallback response when confidence is low
- Agent handoff path for sensitive or unresolved queries

For production, the next optimization step would be logging unknown queries, reviewing low-confidence sessions, and adding new approved patterns every week.

## Engagement Optimization

The chatbot supports engagement through:

- Instant first response
- Short approved answers
- Contextual quick replies
- Typing animation
- Product recommendations
- Clear escalation option

These features reduce friction and keep visitors moving through buying, support, and account workflows.

## Testing

The page includes a built-in quality test set that checks sample user queries against expected intents. It displays:

- Intent accuracy percentage
- Fallback or escalation coverage
- Test query classification results

Recommended production tests:

- Intent accuracy on real customer query logs
- Response helpfulness rating
- Conversion rate with and without the chatbot
- Handoff rate
- Average response time
- Repeat-question rate

