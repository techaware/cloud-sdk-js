import {
  createLogger,
  ErrorWithCause,
  propertyExists
} from '@sap-cloud-sdk/util';
import CircuitBreaker from 'opossum';
import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { decodeJwt, wrapJwtInHeader } from '../jwt';
import {
  circuitBreakerDefaultOptions,
  defaultResilienceBTPServices,
  ResilienceOptions
} from '../resilience-options';
import { urlAndAgent } from '../../http-agent';
import {
  DestinationConfiguration,
  DestinationJson,
  parseDestination
} from './destination';
import { Destination, DestinationType } from './destination-service-types';
import { destinationServiceCache } from './destination-service-cache';
import { DestinationFetchOptions } from './destination-accessor-types';

const logger = createLogger({
  package: 'connectivity',
  messageContext: 'destination-service'
});

type DestinationCircuitBreaker<ResponseType> = CircuitBreaker<
  [requestConfig: AxiosRequestConfig],
  AxiosResponse<ResponseType>
>;

type DestinationsServiceOptions = ResilienceOptions &
  Pick<DestinationFetchOptions, 'useCache'>;
type DestinationServiceOptions = ResilienceOptions &
  Pick<DestinationFetchOptions, 'destinationName'>;

let circuitBreaker: DestinationCircuitBreaker<
  DestinationJson | DestinationConfiguration
>;

/**
 * Fetches all instance destinations from the given URI.
 * @param destinationServiceUri - The URI of the destination service
 * @param jwt - The access token
 * @param options - Options to use by retrieving destinations
 * @returns A promise resolving to a list of instance destinations
 * @internal
 */
export function fetchInstanceDestinations(
  destinationServiceUri: string,
  jwt: string,
  options?: DestinationsServiceOptions
): Promise<Destination[]> {
  return fetchDestinations(
    destinationServiceUri,
    jwt,
    DestinationType.Instance,
    options
  );
}

/**
 * Fetches all subaccount destinations from the given URI.
 * @param destinationServiceUri - The URI of the destination service
 * @param jwt - The access token
 * @param options - Options to use by retrieving destinations
 * @returns A promise resolving to a list of subaccount destinations
 * @internal
 */
export function fetchSubaccountDestinations(
  destinationServiceUri: string,
  jwt: string,
  options?: DestinationsServiceOptions
): Promise<Destination[]> {
  return fetchDestinations(
    destinationServiceUri,
    jwt,
    DestinationType.Subaccount,
    options
  );
}

async function fetchDestinations(
  destinationServiceUri: string,
  jwt: string,
  type: DestinationType,
  options?: DestinationsServiceOptions
): Promise<Destination[]> {
  const targetUri = `${destinationServiceUri.replace(
    /\/$/,
    ''
  )}/destination-configuration/v1/${type}Destinations`;

  if (options?.useCache) {
    const destinationsFromCache =
      destinationServiceCache.retrieveDestinationsFromCache(
        targetUri,
        decodeJwt(jwt)
      );
    if (destinationsFromCache) {
      logger.debug(
        `Destinations retrieved from cache. There were ${destinationsFromCache.length} destinations returned from the cache.`
      );
      return destinationsFromCache;
    }
  }

  const headers = wrapJwtInHeader(jwt).headers;

  return callDestinationService(targetUri, headers, options)
    .then(response => {
      const destinations: Destination[] = response.data.map(d =>
        parseDestination(d)
      );
      if (options?.useCache) {
        destinationServiceCache.cacheRetrievedDestinations(
          targetUri,
          decodeJwt(jwt),
          destinations
        );
      }
      return destinations;
    })
    .catch(error => {
      throw new ErrorWithCause(
        `Failed to fetch ${type} destinations.${errorMessageFromResponse(
          error
        )}`,
        error
      );
    });
}

/**
 *  @internal
 */
export interface AuthAndExchangeTokens {
  authHeaderJwt: string;
  exchangeHeaderJwt?: string;
  exchangeTenant?: string;
}

/**
 * Fetches a specific destination by name from the given URI, including authorization tokens.
 * For destinations with authenticationType OAuth2SAMLBearerAssertion, this call will trigger the OAuth2SAMLBearerFlow against the target destination.
 * In this pass the access token as string.
 * Fetches a specific destination with authenticationType OAuth2UserTokenExchange by name from the given URI, including authorization tokens.
 * @param destinationServiceUri - The URI of the destination service
 * @param token - The access token or AuthAndExchangeTokens if you want to include the X-user-token for OAuth2UserTokenExchange.
 * @param options - Options to use by retrieving destinations
 * @returns A Promise resolving to the destination
 * @internal
 */
export async function fetchDestination(
  destinationServiceUri: string,
  token: string | AuthAndExchangeTokens,
  options: DestinationServiceOptions
): Promise<Destination> {
  return fetchDestinationByTokens(
    destinationServiceUri,
    typeof token === 'string' ? { authHeaderJwt: token } : token,
    options
  );
}

async function fetchDestinationByTokens(
  destinationServiceUri: string,
  tokens: AuthAndExchangeTokens,
  options: DestinationServiceOptions
): Promise<Destination> {
  const targetUri = `${destinationServiceUri.replace(
    /\/$/,
    ''
  )}/destination-configuration/v1/destinations/${options.destinationName}`;

  let authHeader = wrapJwtInHeader(tokens.authHeaderJwt).headers;
  authHeader = tokens.exchangeHeaderJwt
    ? { ...authHeader, 'X-user-token': tokens.exchangeHeaderJwt }
    : authHeader;

  authHeader = tokens.exchangeTenant
    ? { ...authHeader, 'X-tenant': tokens.exchangeTenant }
    : authHeader;

  return callDestinationService(targetUri, authHeader, options)
    .then(response => {
      const destination: Destination = parseDestination(response.data);
      return destination;
    })
    .catch(error => {
      {
        throw new ErrorWithCause(
          `Failed to fetch destination ${
            options.destinationName
          }.${errorMessageFromResponse(error)}`,
          error
        );
      }
    });
}

function errorMessageFromResponse(
  error: AxiosError<{ ErrorMessage: string }>
): string {
  return propertyExists(error, 'response', 'data', 'ErrorMessage')
    ? ` ${error.response!.data.ErrorMessage}`
    : '';
}

function callDestinationService(
  uri: string,
  headers: Record<string, any>,
  options?: ResilienceOptions
): Promise<AxiosResponse<DestinationJson | DestinationConfiguration>> {
  const { enableCircuitBreaker, timeout } = {
    ...defaultResilienceBTPServices,
    ...options
  };
  const config: AxiosRequestConfig = {
    ...urlAndAgent(uri),
    proxy: false,
    method: 'get',
    timeout,
    headers
  };

  if (enableCircuitBreaker) {
    return getCircuitBreaker().fire(config);
  }

  return axios.request(config);
}

function getCircuitBreaker(): DestinationCircuitBreaker<
  DestinationJson | DestinationConfiguration
> {
  const request: (
    config: AxiosRequestConfig
  ) => Promise<AxiosResponse<DestinationJson | DestinationConfiguration>> =
    axios.request;
  if (!circuitBreaker) {
    circuitBreaker = new CircuitBreaker(request, circuitBreakerDefaultOptions);
  }
  return circuitBreaker;
}
