import { HubConnection, HubConnectionBuilder } from '@microsoft/signalr';

export default function createHubConnection(hubUrl: string): HubConnection {
    const connection: HubConnection = new HubConnectionBuilder()
        .withUrl(hubUrl)
        .withAutomaticReconnect()
        .build();

    connection.start()
        .then(() => console.log('Connection started!'))
        .catch(err => console.error('Error while starting connection: ' + err));

    return connection;
}
