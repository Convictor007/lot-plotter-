import { ExpoRequest, ExpoResponse } from 'expo-router/server';

export async function POST(req: ExpoRequest) {
  try {
    const body = await req.json();
    
    // Extract data from the request
    const { 
      userId, 
      type, 
      propertyId, 
      status, 
      notes, 
      applicantName, 
      location, 
      documentsVerified, 
      submittedAt 
    } = body;

    // Basic validation
    if (!type || !applicantName || !propertyId) {
      return ExpoResponse.json(
        { success: false, message: 'Missing required fields: type, applicantName, or propertyId' },
        { status: 400 }
      );
    }

    // Here you would typically insert the record into your database via an ORM or query builder.
    // Per your rules: "use api only and no direct db" from the client.
    // This API route acts as the middle layer.
    
    // Mocking successful database insertion
    const newTransactionId = `txn_${Date.now()}`;

    return ExpoResponse.json(
      { 
        success: true, 
        message: 'Transaction request created successfully',
        data: {
          id: newTransactionId,
          ...body
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating transaction:', error);
    return ExpoResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
