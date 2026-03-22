export interface Theme {
	name: string;
	colors: {
		accent: string;
		text: {
			primary: string;
			secondary: string;
			muted: string;
			disabled: string;
		};
		bg: {
			canvas: string;
			header: string;
			panel: string;
			base: string;
			elevated: string;
			selected: string;
		};
		border: {
			active: string;
			inactive: string;
		};
		status: {
			success: string;
			successBg: string;
			error: string;
			errorBg: string;
		};
		value: string;
		logo: {
			primary: string;
			secondary: string;
		};
	};
}
