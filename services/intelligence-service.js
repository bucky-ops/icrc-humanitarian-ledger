// services/intelligence-service.js - Real-world data integration service
const axios = require('axios');

class IntelligenceService {
  constructor() {
    // These would normally come from environment variables
    this.openWeatherApiKey = process.env.OPENWEATHER_API_KEY || 'demo_key';
    this.openSkyUsername = process.env.OPENSKY_USERNAME || 'demo_user';
    this.openSkyPassword = process.env.OPENSKY_PASSWORD || 'demo_pass';
    this.reliefWebApiKey = process.env.RELIEFWEB_API_KEY || 'demo_key';
  }

  /**
   * Fetches current temperature for a given location using OpenWeatherMap API
   * @param {string} location - Location to get temperature for (e.g., "Geneva,CH")
   * @returns {Object} Temperature data with risk assessment
   */
  async fetchTemperature(location) {
    try {
      // Using a mock response for demonstration since we don't have a real API key
      // In production, you would use: 
      // const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${this.openWeatherApiKey}&units=metric`);
      
      // For demo purposes, we'll simulate the response
      const mockTemp = Math.floor(Math.random() * 40); // Random temp between 0-40°C
      
      return {
        temperature: mockTemp,
        unit: 'celsius',
        location: location,
        timestamp: new Date().toISOString(),
        riskLevel: mockTemp > 30 ? 'High Risk' : 'Normal',
        riskThreshold: 30,
        message: mockTemp > 30 ? `⚠️ Ambient temperature (${mockTemp}°C) exceeds safe threshold (30°C)` : `✓ Temperature (${mockTemp}°C) within safe range`
      };
    } catch (error) {
      console.error('Error fetching temperature:', error.message);
      return {
        temperature: null,
        error: 'Failed to fetch temperature data',
        riskLevel: 'Unknown'
      };
    }
  }

  /**
   * Fetches flight data for a given flight number using OpenSky Network API
   * @param {string} flightNumber - Flight number to track
   * @returns {Object} Flight data
   */
  async fetchFlightData(flightNumber) {
    try {
      // Using a mock response for demonstration
      // In production, you would use:
      // const response = await axios.get(`https://opensky-network.org/api/flights/${flightNumber}`, {
      //   auth: {
      //     username: this.openSkyUsername,
      //     password: this.openSkyPassword
      //   }
      // });
      
      // Mock response for demo
      const mockFlights = [
        {
          flight_number: flightNumber,
          airline: 'SWISS',
          departure_airport: 'ZUR',
          arrival_airport: 'JFK',
          status: 'In Transit',
          latitude: 40.7128,
          longitude: -74.0060,
          altitude: 10668, // meters
          velocity: 250, // m/s
          heading: 270, // degrees
          timestamp: new Date().toISOString()
        },
        {
          flight_number: flightNumber,
          airline: 'KLM',
          departure_airport: 'AMS',
          arrival_airport: 'NBO',
          status: 'In Transit',
          latitude: -1.2864,
          longitude: 36.8172,
          altitude: 11000, // meters
          velocity: 240, // m/s
          heading: 180, // degrees
          timestamp: new Date().toISOString()
        }
      ];
      
      // Find a matching flight or return a random one
      const flight = mockFlights[Math.floor(Math.random() * mockFlights.length)];
      
      return {
        flight_data: flight,
        status: 'success',
        message: `Flight ${flightNumber} is currently in transit`
      };
    } catch (error) {
      console.error('Error fetching flight data:', error.message);
      return {
        flight_data: null,
        status: 'error',
        error: 'Failed to fetch flight data'
      };
    }
  }

  /**
   * Fetches humanitarian reports for a given region using ReliefWeb API
   * @param {string} region - Region to get reports for (e.g., "Kenya", "Syria")
   * @returns {Array} Array of humanitarian reports
   */
  async fetchReliefReports(region) {
    try {
      // Using a mock response for demonstration
      // In production, you would use:
      // const response = await axios.get(`https://api.reliefweb.int/v1/reports?appname=ICRC-Tracking&query[value]=${region}`, {
      //   headers: {
      //     'X-API-Key': this.reliefWebApiKey
      //   }
      // });
      
      // Mock response for demo
      const mockReports = [
        {
          title: `Humanitarian Crisis in ${region}`,
          date: new Date().toISOString(),
          source: 'UNOCHA',
          severity: 'High',
          type: 'Conflict',
          description: `Recent developments in ${region} have led to increased humanitarian needs. Population displacement and resource shortages reported.`,
          url: 'https://reliefweb.int/mock-report'
        },
        {
          title: `Natural Disaster Response in ${region}`,
          date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
          source: 'Red Cross',
          severity: 'Medium',
          type: 'Natural Disaster',
          description: `Emergency response teams deployed to ${region} following recent flooding. Affecting approximately 10,000 people.`,
          url: 'https://reliefweb.int/mock-report-2'
        }
      ];
      
      return {
        reports: mockReports,
        count: mockReports.length,
        region: region,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching relief reports:', error.message);
      return {
        reports: [],
        error: 'Failed to fetch relief reports'
      };
    }
  }

  /**
   * Integrates all intelligence data for a shipment
   * @param {Object} shipment - Shipment object with location, flight info, etc.
   * @returns {Object} Integrated intelligence data
   */
  async getIntelligenceForShipment(shipment) {
    const { location, flightNumber, destination } = shipment;
    
    // Fetch all intelligence data in parallel
    const [tempData, flightData, reportData] = await Promise.all([
      this.fetchTemperature(location),
      flightNumber ? this.fetchFlightData(flightNumber) : Promise.resolve(null),
      destination ? this.fetchReliefReports(destination) : Promise.resolve(null)
    ]);
    
    return {
      shipment_id: shipment.id || 'unknown',
      timestamp: new Date().toISOString(),
      temperature_data: tempData,
      flight_data: flightData,
      relief_reports: reportData,
      risk_assessment: this.calculateRiskAssessment(tempData, flightData, reportData)
    };
  }

  /**
   * Calculates overall risk assessment based on all data sources
   * @param {Object} tempData - Temperature data
   * @param {Object} flightData - Flight data
   * @param {Object} reportData - Relief report data
   * @returns {string} Overall risk level
   */
  calculateRiskAssessment(tempData, flightData, reportData) {
    const riskFactors = [];
    
    if (tempData.riskLevel === 'High Risk') {
      riskFactors.push('Temperature');
    }
    
    if (flightData && flightData.flight_data && flightData.flight_data.status === 'Delayed') {
      riskFactors.push('Flight Delay');
    }
    
    if (reportData && reportData.reports && reportData.reports.some(report => report.severity === 'High')) {
      riskFactors.push('Regional Crisis');
    }
    
    if (riskFactors.length === 0) {
      return 'Low Risk';
    } else if (riskFactors.length === 1) {
      return 'Medium Risk';
    } else {
      return 'High Risk';
    }
  }
}

module.exports = IntelligenceService;