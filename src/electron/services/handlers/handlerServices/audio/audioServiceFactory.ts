import { ConnectorFactory } from "../../../../db/connectorFactory";
import { handlerFactory, HandlerFactoryDecorator } from "../../decorators/handlerFactoryDecorator";
import { AudioService } from "./audioService";

@handlerFactory
export class AudioServiceFactory implements HandlerFactoryDecorator{
    createInstance(): Object {
        const connectorFactory = new ConnectorFactory();
        return new AudioService(connectorFactory.createConnector());
    }
}