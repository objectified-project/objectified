import {
  validateOpenApiParameterName,
} from '../../lib/utils/openapi-parameter-name';

describe('validateOpenApiParameterName', () => {
  it('accepts typical header and cookie tokens', () => {
    expect(validateOpenApiParameterName('Authorization', 'header')).toBeNull();
    expect(validateOpenApiParameterName('X-Request-ID', 'header')).toBeNull();
    expect(validateOpenApiParameterName('session', 'cookie')).toBeNull();
  });

  it('rejects header names with spaces', () => {
    expect(validateOpenApiParameterName('Auth Token', 'header')).not.toBeNull();
  });

  it('accepts query and path names', () => {
    expect(validateOpenApiParameterName('page_size', 'query')).toBeNull();
    expect(validateOpenApiParameterName('userId', 'path')).toBeNull();
  });
});
