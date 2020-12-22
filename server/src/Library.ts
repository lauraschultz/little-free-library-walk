interface Library {
	Library_Name__c: string; // long name
	Library_Geolocation__c: { latitude: any; longitude: any };
	Primary_Steward_s_Email__c?: string;
	List_As_Name__c?: string; // caretaker name
	Official_Charter_Number__c: string;
	Library_Story__c?: string; // user-submitted library story
	Exact_Location_on_Map__c?: boolean; // idk what this means
	Email_on_Map__c?: boolean;
	Street__c?: string; // street address
	City__c?: string; // city
	State_Province_Region__c?: string; // state
	Country__c?: string; // country
	Postal_Zip_Code__c?: string; // zip code
	Id: string; // internal LFL API ID
}

interface LFI {
	statusCode: number;
	result: {
		attachment1?: string;
		attachment2?: string;
		library: Library;
	}[];
}
